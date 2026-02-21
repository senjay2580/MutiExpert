"""Tavily 网络搜索服务 — 为 AI 提供实时网络搜索能力"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

logger = logging.getLogger(__name__)

TAVILY_API_URL = "https://api.tavily.com/search"


async def _get_tavily_key(db: AsyncSession | None = None) -> str:
    """优先从数据库 SiteSetting 读取，回退到环境变量。"""
    if db is not None:
        from app.models.extras import SiteSetting
        result = await db.execute(
            select(SiteSetting.value).where(SiteSetting.key == "tavily_api_key")
        )
        row = result.scalar_one_or_none()
        if row:
            return row
    return get_settings().tavily_api_key


async def tavily_search(
    query: str,
    db: AsyncSession | None = None,
    max_results: int = 5,
    search_depth: str = "basic",
) -> list[dict[str, Any]]:
    """调用 Tavily Search API，返回搜索结果列表。

    每项: {"title", "url", "content", "score"}
    """
    api_key = await _get_tavily_key(db)
    if not api_key:
        logger.warning("Tavily API key not configured, skipping web search")
        return []

    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": search_depth,
        "include_answer": False,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            resp = await client.post(TAVILY_API_URL, json=payload)
            if resp.status_code != 200:
                logger.error("Tavily search failed: %s %s", resp.status_code, resp.text[:200])
                return []
            data = resp.json()
            return [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", ""),
                    "score": r.get("score", 0),
                }
                for r in data.get("results", [])
            ]
    except Exception as e:
        logger.error("Tavily search error: %s", e)
        return []


def build_search_context(results: list[dict[str, Any]], query: str) -> str:
    """将搜索结果格式化为注入 system_prompt 的上下文块。"""
    if not results:
        return ""
    lines = [f"以下是关于「{query}」的网络搜索结果，请参考回答：\n"]
    for i, r in enumerate(results, 1):
        lines.append(f"[搜索{i}] {r['title']}")
        lines.append(f"来源: {r['url']}")
        lines.append(f"{r['content'][:500]}\n")
    return "\n".join(lines)
