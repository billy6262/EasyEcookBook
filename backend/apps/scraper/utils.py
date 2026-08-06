"""
SSRF protection, image download, and ingredient parsing utilities for the scraper feature.

All user-supplied URLs MUST be validated through validate_scrape_url() before
making any outbound HTTP request.
"""

import ipaddress
import logging
import os
import re
import socket
import uuid
from fractions import Fraction
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

# Many recipe sites and their image CDNs reject requests that don't look like a
# real browser (returning 403). Send a realistic User-Agent on every outbound
# request the scraper makes.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def validate_scrape_url(url: str) -> None:
    """
    Validate a user-submitted URL before making a server-side HTTP request.
    Raises ValidationError if the URL could trigger an SSRF attack.

    Checks:
      1. Scheme must be http or https
      2. Hostname must be resolvable
      3. Resolved IP must not be private, loopback, link-local, or reserved
    """
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValidationError("Only http and https URLs are supported.")

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError("Invalid URL: missing hostname.")

    try:
        # Resolve to an IP address
        addr = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(addr)
    except socket.gaierror:
        raise ValidationError(f"Could not resolve hostname: {hostname}")

    if ip.is_private:
        raise ValidationError("Requests to private network addresses are not allowed.")
    if ip.is_loopback:
        raise ValidationError("Requests to loopback addresses are not allowed.")
    if ip.is_link_local:
        raise ValidationError("Requests to link-local addresses are not allowed.")
    if ip.is_reserved:
        raise ValidationError("Requests to reserved IP ranges are not allowed.")


_MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
}
# Fallback: infer type from the URL's file extension when the server sends no
# (or a generic) Content-Type header.
_EXT_TO_TYPE = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
}


def fetch_page_html(url: str) -> str:
    """
    Fetch the HTML of a recipe page using a browser User-Agent.

    The caller MUST have already validated *url* with validate_scrape_url().
    Raises requests exceptions on network/HTTP failure.
    """
    headers = {
        "User-Agent": BROWSER_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    return response.text


def download_and_store_image(image_url: str) -> str | None:
    """
    Download an image from *image_url*, validate it, upload it to the
    configured storage backend, and return the stored file URL.

    Returns None (non-fatal) if anything goes wrong so that a scrape
    failure on the image does not prevent the recipe from being imported.
    """
    try:
        validate_scrape_url(image_url)
    except Exception:
        return None

    try:
        parsed = urlparse(image_url)
        headers = {
            "User-Agent": BROWSER_USER_AGENT,
            # Some CDNs use hotlink protection keyed on the Referer.
            "Referer": f"{parsed.scheme}://{parsed.netloc}/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        }
        response = requests.get(image_url, timeout=10, stream=True, headers=headers)
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        ext = _ALLOWED_IMAGE_TYPES.get(content_type)

        # Fall back to the URL's file extension if the Content-Type is missing
        # or generic (e.g. application/octet-stream from some CDNs).
        if ext is None:
            url_ext = os.path.splitext(parsed.path)[1].lower()
            inferred = _EXT_TO_TYPE.get(url_ext)
            if inferred is None:
                return None
            ext = _ALLOWED_IMAGE_TYPES[inferred]

        # Read with a hard cap to avoid memory exhaustion
        chunks = []
        total = 0
        for chunk in response.iter_content(chunk_size=65536):
            total += len(chunk)
            if total > _MAX_IMAGE_BYTES:
                return None
            chunks.append(chunk)

        data = b"".join(chunks)
        if not data:
            return None

        filename = f"scraped_images/{uuid.uuid4().hex}{ext}"
        path = default_storage.save(filename, ContentFile(data))

        # Build a browser-reachable URL. In Docker, default_storage.url() would
        # return the internal "http://minio:9000/..." host, which the browser
        # can't resolve and which also fails Django's URLField validation.
        public_base = getattr(settings, "MINIO_PUBLIC_URL_BASE", None)
        if public_base:
            return f"{public_base}{path}"
        return default_storage.url(path)

    except Exception:
        logger.exception("Failed to download scraped image from %s", image_url)
        return None


# ---------------------------------------------------------------------------
# Ingredient string parser
# ---------------------------------------------------------------------------

# Unicode fraction characters → ASCII fraction strings
_UNICODE_FRACTIONS: dict[str, str] = {
    "\u00bd": "1/2",  # ½
    "\u00bc": "1/4",  # ¼
    "\u00be": "3/4",  # ¾
    "\u2153": "1/3",  # ⅓
    "\u2154": "2/3",  # ⅔
    "\u215b": "1/8",  # ⅛
    "\u215c": "3/8",  # ⅜
    "\u215d": "5/8",  # ⅝
    "\u215e": "7/8",  # ⅞
    "\u2159": "1/6",  # ⅙
    "\u215a": "5/6",  # ⅚
}

# Unit aliases → canonical display name.
# Multi-word entries must appear before single-word ones so the regex tries
# them first.  Keys are lower-case.
_UNIT_MAP: dict[str, str] = {
    # multi-word (tried first)
    "fluid ounces": "fl oz",
    "fluid ounce": "fl oz",
    "fl oz": "fl oz",
    "fl. oz.": "fl oz",
    # volume
    "cups": "cup",
    "cup": "cup",
    "tablespoons": "tbsp",
    "tablespoon": "tbsp",
    "tbsp": "tbsp",
    "tbs": "tbsp",
    "teaspoons": "tsp",
    "teaspoon": "tsp",
    "tsp": "tsp",
    "liters": "l",
    "liter": "l",
    "litres": "l",
    "litre": "l",
    "l": "l",
    "milliliters": "ml",
    "milliliter": "ml",
    "millilitres": "ml",
    "millilitre": "ml",
    "ml": "ml",
    "dl": "dl",
    # weight
    "pounds": "lb",
    "pound": "lb",
    "lbs": "lb",
    "lb": "lb",
    "ounces": "oz",
    "ounce": "oz",
    "oz": "oz",
    "grams": "g",
    "gram": "g",
    "g": "g",
    "kilograms": "kg",
    "kilogram": "kg",
    "kg": "kg",
    # discrete / count
    "cloves": "clove",
    "clove": "clove",
    "slices": "slice",
    "slice": "slice",
    "pieces": "piece",
    "piece": "piece",
    "pinches": "pinch",
    "pinch": "pinch",
    "bunches": "bunch",
    "bunch": "bunch",
    "sprigs": "sprig",
    "sprig": "sprig",
    "cans": "can",
    "can": "can",
    "packages": "package",
    "package": "package",
    "pkg": "package",
    "stalks": "stalk",
    "stalk": "stalk",
    "heads": "head",
    "head": "head",
    "inches": "inch",
    "inch": "inch",
    "strips": "strip",
    "strip": "strip",
    "sheets": "sheet",
    "sheet": "sheet",
    "drops": "drop",
    "drop": "drop",
    "handfuls": "handful",
    "handful": "handful",
    "knobs": "knob",
    "knob": "knob",
    "packets": "packet",
    "packet": "packet",
    "envelopes": "envelope",
    "envelope": "envelope",
    "sticks": "stick",
    "stick": "stick",
}

# Single-token unit keys (no internal spaces), matched longest-first.
# The multi-word "fl oz" family is handled by a dedicated regex branch below so
# that spellings like "fl oz", "fl. oz." and "floz" all resolve correctly.
_SINGLE_UNIT_KEYS = sorted(
    (k for k in _UNIT_MAP if " " not in k),
    key=len,
    reverse=True,
)
_UNIT_ALT = "|".join(re.escape(k) for k in _SINGLE_UNIT_KEYS)

# A unit is: the "fl oz" family, OR a single-token unit, each optionally
# followed by a period, and must be followed by whitespace / punctuation / end.
# The trailing lookahead prevents matching a unit that is really the start of an
# ingredient name (e.g. "g" in "garlic", "l" in "lemon").
_UNIT_PATTERN = re.compile(
    r"^(?:fl\.?\s*oz\.?|(?P<single>" + _UNIT_ALT + r")\.?)(?=[\s,;/()\-]|$)",
    re.IGNORECASE,
)

# Size/preparation words that follow a quantity but are NOT units
_SIZE_WORDS = {"large", "medium", "small", "extra-large", "xl", "lg", "sm", "big"}

# Superscript footnote markers (e.g. "flour\u00b9", "yeast\u00b2") that recipe sites
# attach to ingredient names — strip them entirely.
_SUPERSCRIPT_RE = re.compile(r"[\u00b9\u00b2\u00b3\u2070\u2071\u2074-\u2079]")

# A single numeric "token": a mixed number ("1 1/2"), a fraction ("1/2"), or a
# plain integer / decimal. Used to detect ranges like "2-2 1/3" or "1/8-1/4".
_NUM = r"(?:\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+(?:\.\d+)?)"
_RANGE_RE = re.compile(r"^(" + _NUM + r")\s*[-\u2013]\s*(" + _NUM + r")\s*(.*)", re.DOTALL)
_SINGLE_RE = re.compile(r"^(" + _NUM + r")\s*(.*)", re.DOTALL)


def _normalize_unicode_fractions(s: str) -> str:
    s = _SUPERSCRIPT_RE.sub("", s)
    for char, asc in _UNICODE_FRACTIONS.items():
        s = s.replace(char, f" {asc} ")
    return " ".join(s.split())  # collapse extra spaces


def _fmt_qty(value: float) -> str:
    """
    Format a numeric quantity for the recipe's DecimalField(decimal_places=3):
    whole numbers drop the decimal, others are rounded to at most 3 places with
    trailing zeros stripped (e.g. 1/3 -> '0.333', 1.5 -> '1.5').
    """
    if value == int(value):
        return str(int(value))
    return f"{value:.3f}".rstrip("0").rstrip(".")


def _token_to_qty(tok: str) -> str:
    """Convert a numeric token (mixed / fraction / decimal) to a clean string."""
    tok = tok.strip()
    m = re.fullmatch(r"(\d+)\s+(\d+)\s*/\s*(\d+)", tok)
    if m:
        value = int(m.group(1)) + float(Fraction(int(m.group(2)), int(m.group(3))))
        return _fmt_qty(value)
    m = re.fullmatch(r"(\d+)\s*/\s*(\d+)", tok)
    if m:
        return _fmt_qty(float(Fraction(int(m.group(1)), int(m.group(2)))))
    return tok


def _extract_quantity(s: str) -> tuple[str, str]:
    """
    Pull a leading numeric quantity from *s*.
    Returns (quantity_str, remainder_str).
    Handles integers, decimals, fractions (1/2), mixed numbers (1 1/2), and
    ranges whose bounds may themselves be fractions/mixed numbers
    (e.g. "2-2 1/3", "1/8-1/4") — the lower bound is used.
    """
    s = s.strip()

    m = _RANGE_RE.match(s)
    if m:
        return _token_to_qty(m.group(1)), m.group(3).strip()

    m = _SINGLE_RE.match(s)
    if m:
        return _token_to_qty(m.group(1)), m.group(2).strip()

    return "", s


def _extract_unit(s: str) -> tuple[str, str]:
    """Match a leading known unit in *s*. Returns (canonical_unit, remainder)."""
    m = _UNIT_PATTERN.match(s)
    if not m:
        return "", s
    single = m.group("single")
    if single is not None:
        canonical = _UNIT_MAP.get(single.lower().rstrip("."), "")
    else:
        canonical = "fl oz"
    if not canonical:
        return "", s
    return canonical, s[m.end():].strip()


def _strip_parentheticals(s: str) -> tuple[str, list[str]]:
    """
    Remove ALL parenthetical groups (including nested ones) and return the
    remaining text plus the collected notes in reading order.
    e.g. "flour (divided (250-295g))" -> ("flour", ["divided", "250-295g"])
    """
    notes: list[str] = []
    pattern = re.compile(r"\(([^()]*)\)")
    while True:
        m = pattern.search(s)
        if not m:
            break
        inner = m.group(1).strip()
        if inner:
            notes.append(inner)
        s = s[: m.start()] + " " + s[m.end():]
    # Innermost groups are removed first; reverse so outer notes read first.
    notes.reverse()
    # Drop any leftover unbalanced parentheses.
    s = s.replace("(", " ").replace(")", " ")
    return re.sub(r"\s+", " ", s).strip(), notes


def parse_ingredient_str(ingredient_str: str) -> dict:
    """
    Parse a free-text ingredient string into structured components.

    Returns a dict with keys: quantity, unit, ingredient_name, notes.

    Examples
    --------
    '1 cup flour'              → {qty:'1',   unit:'cup',  name:'flour',       notes:''}
    '1/2 tsp salt'             → {qty:'0.5', unit:'tsp',  name:'salt',        notes:''}
    '1 1/2 cups chicken broth' → {qty:'1.5', unit:'cup',  name:'chicken broth', notes:''}
    '3 large eggs'             → {qty:'3',   unit:'',     name:'eggs',        notes:'large'}
    'garlic cloves, minced'    → {qty:'',    unit:'',     name:'garlic cloves', notes:'minced'}
    '200g butter (softened)'   → {qty:'200', unit:'g',    name:'butter',      notes:'softened'}
    """
    s = _normalize_unicode_fractions(ingredient_str.strip())

    quantity, s = _extract_quantity(s)

    # Strip parentheticals into notes early — one may sit between the quantity
    # and the unit (e.g. "1 (14.5 ounce) can diced tomatoes"), and they may be
    # nested (e.g. "flour (divided (250-295g))").
    s, paren_notes = _strip_parentheticals(s)

    unit, s = _extract_unit(s)

    # If no unit found but the next token is a size word, treat it as a note
    size_note = ""
    if not unit and s.split():
        first_word = s.split()[0]
        if first_word.lower().rstrip(",") in _SIZE_WORDS:
            size_note = first_word.rstrip(",")
            s = s[len(first_word):].strip()

    # Drop a leading connective left over after unit extraction
    # (e.g. "pinch of nutmeg" -> "nutmeg").
    s = re.sub(r"^of\s+", "", s, flags=re.IGNORECASE).strip()

    # Split on first comma for trailing notes
    if "," in s:
        name_part, comma_note = s.split(",", 1)
        ingredient_name = name_part.strip()
        comma_note = comma_note.strip()
    else:
        ingredient_name = s.strip()
        comma_note = ""

    # Assemble notes from all collected parts
    note_parts = [p for p in (size_note, *paren_notes, comma_note) if p]
    notes = ", ".join(note_parts)

    return {
        "quantity": quantity,
        "unit": unit,
        "ingredient_name": ingredient_name,
        "notes": notes,
    }
