from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from apps.scraper import utils


class ScraperUrlPolicyTests(SimpleTestCase):
    def test_rejects_url_credentials(self):
        with self.assertRaises(ValidationError):
            utils.validate_scrape_url("https://user:password@example.com/recipe")

    @patch("apps.scraper.utils.socket.getaddrinfo")
    def test_rejects_hostname_with_any_non_public_address(self, getaddrinfo):
        getaddrinfo.return_value = [
            (2, 1, 6, "", ("93.184.216.34", 443)),
            (2, 1, 6, "", ("127.0.0.1", 443)),
        ]

        with self.assertRaises(ValidationError):
            utils.validate_scrape_url("https://example.com/recipe")

    @patch("apps.scraper.utils._request_pinned")
    def test_validates_each_redirect_target(self, request_pinned):
        redirect = _Response(status_code=302, headers={"Location": "https://next.example/recipe"})
        final = _Response(status_code=200, headers={})
        request_pinned.side_effect = [redirect, final]

        utils._safe_get("https://start.example/recipe", headers={}, timeout=1, stream=True)

        self.assertEqual(
            [call.args[0] for call in request_pinned.call_args_list],
            ["https://start.example/recipe", "https://next.example/recipe"],
        )

    @patch("apps.scraper.utils._safe_get")
    def test_rejects_oversized_html_response(self, safe_get):
        safe_get.return_value = _Response(
            status_code=200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            chunks=[b"x" * (utils._MAX_HTML_BYTES + 1)],
        )

        with self.assertRaises(ValueError):
            utils.fetch_page_html("https://example.com/recipe")


class _Response:
    def __init__(self, status_code, headers, chunks=None):
        self.status_code = status_code
        self.headers = headers
        self.encoding = "utf-8"
        self._chunks = chunks or []

    @property
    def is_redirect(self):
        return self.status_code in {301, 302, 303, 307, 308}

    def iter_content(self, chunk_size):
        yield from self._chunks

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("HTTP error")

    def close(self):
        pass