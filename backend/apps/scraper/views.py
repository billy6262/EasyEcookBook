import re

from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ScrapedRecipe
from .serializers import ScrapeRequestSerializer, ScrapeResultSerializer
from .utils import download_and_store_image, fetch_page_html, parse_ingredient_str

# `recipe_scrapers` is an optional dependency (see requirements.txt). Import it
# lazily so a missing package doesn't crash the entire URLconf at startup.
try:
    from recipe_scrapers import scrape_html
    from recipe_scrapers._exceptions import (
        NoSchemaFoundInWildMode,
        WebsiteNotImplementedError,
    )

    SCRAPER_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - depends on optional install
    scrape_html = None
    WebsiteNotImplementedError = NoSchemaFoundInWildMode = Exception
    SCRAPER_AVAILABLE = False


def _safe_int(value) -> int | None:
    """Convert a scraped time/servings value to int, returning None on failure."""
    try:
        return int(value) if value else None
    except (TypeError, ValueError):
        return None


def _parse_servings(yields_str: str | None) -> int | None:
    """Extract the leading integer from strings like '4 servings' or '4-6'."""
    if not yields_str:
        return None
    match = re.search(r"\d+", str(yields_str))
    return int(match.group()) if match else None


class ScrapeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not SCRAPER_AVAILABLE:
            return Response(
                {"detail": "Recipe scraping is not available on this server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = ScrapeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        url = serializer.validated_data["url"]

        # --- Scrape ---
        # Fetch the page ourselves with a browser User-Agent (many sites and
        # their image CDNs block requests without one), then parse the HTML.
        try:
            html = fetch_page_html(url)
            scraper = scrape_html(html, org_url=url, wild_mode=True)
        except WebsiteNotImplementedError:
            return Response(
                {"detail": "This website is not supported by the recipe scraper."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except NoSchemaFoundInWildMode:
            return Response(
                {"detail": "No recipe data could be found at this URL."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except Exception:
            return Response(
                {"detail": "Failed to fetch or parse the recipe from the provided URL."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # --- Extract fields (each scraper method may raise; fall back to None) ---
        def safe(fn):
            try:
                return fn()
            except Exception:
                return None

        title = safe(scraper.title) or ""
        description = safe(scraper.description) or ""
        prep_time = _safe_int(safe(scraper.prep_time))
        cook_time = _safe_int(safe(scraper.cook_time))
        servings = _parse_servings(safe(scraper.yields))
        ingredients = safe(scraper.ingredients) or []
        steps = safe(scraper.instructions_list) or []
        image_url = safe(scraper.image)

        # Filter out blank steps/ingredients that some scrapers emit
        raw_ingredients = [i for i in ingredients if i and i.strip()]
        steps = [s for s in steps if s and s.strip()]

        # Parse each ingredient string into structured fields
        parsed_ingredients = [parse_ingredient_str(i) for i in raw_ingredients]

        # --- Cover image ---
        cover_image_url = download_and_store_image(image_url) if image_url else None

        # --- Persist for audit ---
        raw_data = {
            "title": title,
            "description": description,
            "prep_time": prep_time,
            "cook_time": cook_time,
            "servings": servings,
            "ingredients": parsed_ingredients,
            "steps": steps,
            "image_url": image_url,
            "cover_image_url": cover_image_url,
        }
        scraped = ScrapedRecipe.objects.create(
            url=url,
            requested_by=request.user,
            status=ScrapedRecipe.STATUS_COMPLETED,
            raw_data=raw_data,
        )

        # --- Response ---
        result = ScrapeResultSerializer(
            {
                "scraped_id": scraped.pk,
                "title": title,
                "description": description,
                "prep_time": prep_time,
                "cook_time": cook_time,
                "servings": servings,
                "source_url": url,
                "cover_image_url": cover_image_url,
                "ingredients": parsed_ingredients,
                "steps": steps,
            }
        )
        return Response(result.data, status=status.HTTP_200_OK)
