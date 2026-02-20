"""URL 文档抓取 - 用于 link 类型资料的内容抽取（带基础 SSRF 防护）"""

from __future__ import annotations

import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx

from app.config import get_settings


class UnsafeUrlError(ValueError):
    pass


def _is_safe_ip(ip_str: str) -> bool:
    ip_str = ip_str.split("%", 1)[0]
    ip = ipaddress.ip_address(ip_str)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
    )


def validate_public_url(url: str) -> None:
    """拒绝 localhost/内网地址，降低 SSRF 风险。"""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError("Only http/https URLs are allowed")
    if not parsed.hostname:
        raise UnsafeUrlError("Invalid URL host")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("Credentials in URL are not allowed")

    hostname = parsed.hostname.lower()
    if hostname in {"localhost"}:
        raise UnsafeUrlError("Localhost URLs are not allowed")

    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise UnsafeUrlError(f"Cannot resolve host: {hostname}") from e

    for info in infos:
        sockaddr = info[4]
        ip_str = sockaddr[0]
        if not _is_safe_ip(ip_str):
            raise UnsafeUrlError("URL resolves to a private or unsafe network address")


def _strip_html(html: str) -> str:
    html = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?>.*?</style>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    html = re.sub(r"\s+", " ", html)
    return html.strip()


async def fetch_url_text(url: str) -> str:
    """抓取 URL 内容并提取纯文本（HTML 会剥离标签）。"""
    validate_public_url(url)

    settings = get_settings()
    max_bytes = getattr(settings, "max_link_fetch_size", 2_000_000)

    timeout = httpx.Timeout(10.0, connect=5.0)
    headers = {"User-Agent": "MutiExpert/0.1"}

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        try:
            current_url = url
            for _ in range(3):
                async with client.stream("GET", current_url, follow_redirects=False) as resp:
                    if resp.status_code in {301, 302, 303, 307, 308}:
                        location = resp.headers.get("location")
                        if not location:
                            resp.raise_for_status()
                        next_url = urljoin(str(resp.url), location)
                        validate_public_url(next_url)
                        current_url = next_url
                        continue

                    resp.raise_for_status()
                    content_type = resp.headers.get("content-type", "")

                    total = 0
                    chunks: list[bytes] = []
                    async for chunk in resp.aiter_bytes():
                        total += len(chunk)
                        if total > max_bytes:
                            raise ValueError("Remote content too large")
                        chunks.append(chunk)

                    raw = b"".join(chunks)
                    text = raw.decode("utf-8", errors="ignore")
                    if "text/html" in content_type.lower():
                        text = _strip_html(text)
                    return text.strip()

            raise ValueError("Too many redirects")
        except httpx.HTTPError as e:
            raise ValueError("Failed to fetch URL content") from e
