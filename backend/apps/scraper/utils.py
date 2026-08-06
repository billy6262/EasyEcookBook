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
from dataclasses import dataclass
from fractions import Fraction
from html import unescape as _html_unescape
from io import BytesIO
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, UnidentifiedImageError
from requests.adapters import HTTPAdapter
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool

logger = logging.getLogger(__name__)

# Many recipe sites and their image CDNs reject requests that don't look like a
# real browser (returning 403). Send a realistic User-Agent on every outbound
# request the scraper makes.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

_MAX_REDIRECTS = 3
_MAX_HTML_BYTES = 5 * 1024 * 1024  # 5 MB
_HTML_CONTENT_TYPES = {"text/html", "application/xhtml+xml"}


@dataclass(frozen=True)
class _ResolvedTarget:
    hostname: str
    port: int
    address: str


class _PinnedAddressAdapter(HTTPAdapter):
    """Connect to a validated IP while retaining HTTPS hostname verification."""

    def __init__(self, target: _ResolvedTarget):
        self._target = target
        super().__init__(pool_connections=1, pool_maxsize=1, max_retries=0)

    def send(self, request, **kwargs):
        host = self._target.hostname
        if ":" in host and not host.startswith("["):
            host = f"[{host}]"
        default_port = 443 if request.url.startswith("https://") else 80
        if self._target.port != default_port:
            host = f"{host}:{self._target.port}"
        request.headers["Host"] = host
        return super().send(request, **kwargs)

    def get_connection_with_tls_context(self, request, verify, proxies=None, cert=None):
        if request.url.startswith("https://"):
            return HTTPSConnectionPool(
                host=self._target.address,
                port=self._target.port,
                maxsize=1,
                block=True,
                assert_hostname=self._target.hostname,
                server_hostname=self._target.hostname,
            )
        return HTTPConnectionPool(
            host=self._target.address,
            port=self._target.port,
            maxsize=1,
            block=True,
        )


def _resolve_public_target(url: str) -> _ResolvedTarget:
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValidationError("Only http and https URLs are supported.")
    if parsed.username or parsed.password:
        raise ValidationError("URLs with credentials are not allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError("Invalid URL: missing hostname.")

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        results = socket.getaddrinfo(
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except (socket.gaierror, ValueError):
        raise ValidationError(f"Could not resolve hostname: {hostname}")

    addresses = []
    for _, _, _, _, sockaddr in results:
        address = sockaddr[0]
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            raise ValidationError("Hostname resolved to an invalid address.")
        if not ip.is_global:
            raise ValidationError("Requests to non-public network addresses are not allowed.")
        addresses.append(str(ip))

    if not addresses:
        raise ValidationError(f"Could not resolve hostname: {hostname}")
    return _ResolvedTarget(hostname=hostname, port=port, address=addresses[0])


def validate_scrape_url(url: str) -> None:
    """
    Validate a user-submitted URL before making a server-side HTTP request.
    Raises ValidationError if the URL could trigger an SSRF attack.

    Checks:
      1. Scheme must be http or https
      2. Hostname must be resolvable
      3. Resolved IP must not be private, loopback, link-local, or reserved
    """
    _resolve_public_target(url)


def _request_pinned(url: str, *, headers: dict[str, str], timeout, stream: bool):
    target = _resolve_public_target(url)
    session = requests.Session()
    session.trust_env = False
    adapter = _PinnedAddressAdapter(target)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    try:
        response = session.get(
            url,
            headers=headers,
            timeout=timeout,
            stream=stream,
            allow_redirects=False,
        )
    except Exception:
        session.close()
        raise
    response._scraper_session = session
    return response


def _close_response(response) -> None:
    try:
        response.close()
    finally:
        session = getattr(response, "_scraper_session", None)
        if session is not None:
            session.close()


def _safe_get(url: str, *, headers: dict[str, str], timeout, stream: bool):
    current_url = url
    for redirect_count in range(_MAX_REDIRECTS + 1):
        response = _request_pinned(
            current_url,
            headers=headers,
            timeout=timeout,
            stream=stream,
        )
        location = response.headers.get("Location")
        if response.is_redirect and location:
            _close_response(response)
            if redirect_count == _MAX_REDIRECTS:
                raise requests.TooManyRedirects("Too many redirects while fetching recipe URL.")
            current_url = urljoin(current_url, location)
            continue
        return response
    raise requests.TooManyRedirects("Too many redirects while fetching recipe URL.")


def _read_response_limited(response, limit: int) -> bytes:
    chunks = []
    total = 0
    for chunk in response.iter_content(chunk_size=65536):
        total += len(chunk)
        if total > limit:
            raise ValueError("Response exceeds the maximum allowed size.")
        chunks.append(chunk)
    return b"".join(chunks)


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
    response = _safe_get(url, headers=headers, timeout=(5, 15), stream=True)
    try:
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
        if content_type not in _HTML_CONTENT_TYPES:
            raise ValueError("The URL did not return an HTML document.")
        html_bytes = _read_response_limited(response, _MAX_HTML_BYTES)
        return html_bytes.decode(response.encoding or "utf-8", errors="replace")
    finally:
        _close_response(response)


def download_and_store_image(image_url: str) -> str | None:
    """
    Download an image from *image_url*, validate it, upload it to the
    configured storage backend, and return the stored file URL.

    Returns None (non-fatal) if anything goes wrong so that a scrape
    failure on the image does not prevent the recipe from being imported.
    """
    try:
        parsed = urlparse(image_url)
        headers = {
            "User-Agent": BROWSER_USER_AGENT,
            # Some CDNs use hotlink protection keyed on the Referer.
            "Referer": f"{parsed.scheme}://{parsed.netloc}/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        }
        response = _safe_get(image_url, timeout=(5, 10), stream=True, headers=headers)
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

        data = _read_response_limited(response, _MAX_IMAGE_BYTES)
        if not data:
            return None
        try:
            Image.open(BytesIO(data)).verify()
        except (UnidentifiedImageError, OSError):
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
        logger.exception("Failed to download scraped image from %s", urlparse(image_url).hostname)
        return None
    finally:
        if "response" in locals():
            _close_response(response)


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


# ---------------------------------------------------------------------------
# schema.org JSON-LD fallback parser
# ---------------------------------------------------------------------------
# Used when `recipe_scrapers` is unavailable or crashes on a page's structured
# data. Most recipe sites embed a standard schema.org/Recipe object in a
# <script type="application/ld+json"> tag, so we can parse it directly.

_ISO_DURATION_RE = re.compile(
    r"^P(?:(?P<w>\d+)W)?(?:(?P<d>\d+)D)?"
    r"(?:T(?:(?P<h>\d+)H)?(?:(?P<m>\d+)M)?(?:(?P<s>\d+)S)?)?$",
    re.IGNORECASE,
)


def _iso_duration_to_minutes(value) -> int | None:
    """Convert an ISO-8601 duration (e.g. 'PT1H30M') to whole minutes."""
    if not value or not isinstance(value, str):
        return None
    m = _ISO_DURATION_RE.fullmatch(value.strip())
    if not m:
        return None
    weeks = int(m.group("w") or 0)
    days = int(m.group("d") or 0)
    hours = int(m.group("h") or 0)
    minutes = int(m.group("m") or 0)
    seconds = int(m.group("s") or 0)
    total = weeks * 10080 + days * 1440 + hours * 60 + minutes + seconds // 60
    return total or None


def _first(value):
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _jsonld_image(value) -> str | None:
    value = _first(value)
    if isinstance(value, dict):
        return value.get("url")
    if isinstance(value, str):
        return value
    return None


def _jsonld_instructions(value) -> list[str]:
    """Flatten recipeInstructions (string / list / HowToStep / HowToSection)."""
    steps: list[str] = []

    def walk(node):
        if isinstance(node, str):
            text = node.strip()
            if text:
                steps.append(text)
        elif isinstance(node, dict):
            node_type = str(node.get("@type", ""))
            if "HowToSection" in node_type:
                walk(node.get("itemListElement", []))
            else:
                text = node.get("text") or node.get("name")
                if text and str(text).strip():
                    steps.append(str(text).strip())
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(value)
    return steps


def _find_recipe_node(node):
    """Recursively locate a schema.org Recipe object (handles @graph/lists)."""
    if isinstance(node, dict):
        node_type = node.get("@type")
        types = node_type if isinstance(node_type, list) else [node_type]
        if any(str(t).lower() == "recipe" for t in types if t):
            return node
        for value in node.values():
            found = _find_recipe_node(value)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _find_recipe_node(item)
            if found:
                return found
    return None


class _JsonLdRecipe:
    """
    Adapter exposing the same method surface the view expects from a
    `recipe_scrapers` scraper, backed by a schema.org Recipe dict.
    """

    def __init__(self, data: dict):
        self._d = data

    def title(self) -> str:
        return _html_unescape(str(self._d.get("name") or "")).strip()

    def description(self) -> str:
        return _html_unescape(str(self._d.get("description") or "")).strip()

    def prep_time(self) -> int | None:
        return _iso_duration_to_minutes(self._d.get("prepTime"))

    def cook_time(self) -> int | None:
        return _iso_duration_to_minutes(self._d.get("cookTime"))

    def total_time(self) -> int | None:
        return _iso_duration_to_minutes(self._d.get("totalTime"))

    def yields(self) -> str | None:
        value = self._d.get("recipeYield")
        value = _first(value) if isinstance(value, list) else value
        return str(value) if value not in (None, "") else None

    def image(self) -> str | None:
        return _jsonld_image(self._d.get("image"))

    def ingredients(self) -> list[str]:
        raw = self._d.get("recipeIngredient") or self._d.get("ingredients") or []
        return [_html_unescape(str(i)) for i in raw if i and str(i).strip()]

    def instructions_list(self) -> list[str]:
        return [_html_unescape(s) for s in _jsonld_instructions(self._d.get("recipeInstructions"))]


def parse_recipe_jsonld(html_text: str):
    """
    Parse a schema.org/Recipe from a page's JSON-LD.

    Returns a `_JsonLdRecipe` (duck-typed like a recipe_scrapers scraper) or
    None if no recipe could be found. Never raises.
    """
    try:
        import extruct

        data = extruct.extract(html_text, syntaxes=["json-ld"], uniform=True)
        items = data.get("json-ld", [])
    except Exception:
        logger.exception("JSON-LD extraction failed")
        return None

    recipe = _find_recipe_node(items)
    if not recipe:
        return None
    return _JsonLdRecipe(recipe)
