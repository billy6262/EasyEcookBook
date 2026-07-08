"""
SSRF (Server-Side Request Forgery) protection utilities for the scraper feature.

When the scraper feature is built, ALL user-supplied URLs must be validated
through validate_scrape_url() before making any outbound HTTP request.

This file is intentionally stubbed out now so:
  a) The location is established and won't be forgotten
  b) The basic validation logic is in place and tested
  c) The implementation is correct from day one
"""

import ipaddress
import socket
from urllib.parse import urlparse

from django.core.exceptions import ValidationError


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
