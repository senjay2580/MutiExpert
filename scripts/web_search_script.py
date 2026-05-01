#!/usr/bin/env python3
"""线上版 web-search-plus 精简（GitHub + Tavily + Reddit）

调用方式（通过 MutiExpert 脚本系统）：
    create_scripts_by_id_test(
        script_id=...,
        timeout=60,
        args=["--query", "AI agent trending", "-p", "github", "-n", "10"]
    )

环境变量（自动从 ENV_VAR_REGISTRY 注入）：
    TAVILY_API_KEY  必需（用 -p tavily 时）
    GITHUB_TOKEN    可选（提升 GitHub API 配额从 60→5000 次/小时）

输出：Markdown 列表（标题 + 链接 + 元数据），适合飞书发送。
"""

import argparse
import os
import sys
from urllib.parse import quote

import httpx

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "").strip()


def log(msg: str):
    """日志走 stderr，stdout 留给最终 Markdown"""
    print(msg, file=sys.stderr, flush=True)


# ── GitHub ────────────────────────────────────────────────
def search_github(query: str, n: int = 10, sort: str = "stars",
                  language: str | None = None, created_after: str | None = None) -> list[dict]:
    """GitHub repository search. sort: stars / forks / updated / help-wanted-issues。
    created_after: YYYY-MM-DD（找近期热门项目用），language: python/rust/...."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    parts = [query]
    if language:
        parts.append(f"language:{language}")
    if created_after:
        parts.append(f"created:>{created_after}")

    url = (
        f"https://api.github.com/search/repositories?"
        f"q={quote(' '.join(parts))}&sort={sort}&order=desc&per_page={n}"
    )
    log(f"[github] GET {url}")
    r = httpx.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json().get("items", [])[:n]


def fmt_github(items: list[dict], query: str) -> str:
    if not items:
        return "_GitHub 无结果_"
    lines = []
    for i, it in enumerate(items, 1):
        full_name = it.get("full_name", "")
        url = it.get("html_url", "")
        stars = it.get("stargazers_count", 0)
        forks = it.get("forks_count", 0)
        lang = it.get("language") or "—"
        desc = (it.get("description") or "").strip() or "_无描述_"
        topics = it.get("topics", [])[:5]
        topics_str = " ".join(f"`{t}`" for t in topics) if topics else ""
        updated = (it.get("updated_at") or "")[:10]
        lines.append(
            f"### {i}. [{full_name}]({url})\n\n"
            f"⭐ **{stars:,}** · 🍴 {forks:,} · 💻 {lang} · 📅 {updated}\n\n"
            f"{desc}\n\n"
            f"{topics_str}\n"
        )
    return "\n---\n\n".join(lines)


# ── Tavily ────────────────────────────────────────────────
def search_tavily(query: str, n: int = 10, depth: str = "basic") -> list[dict]:
    """Tavily Research API，自动抓取网页内容并摘要。depth: basic/advanced（advanced 慢但深）"""
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY 未配置——在系统设置 → 站点设置 配 tavily_api_key")
    log(f"[tavily] depth={depth} query={query!r}")
    r = httpx.post(
        "https://api.tavily.com/search",
        json={
            "api_key": TAVILY_API_KEY,
            "query": query,
            "search_depth": depth,
            "max_results": n,
            "include_answer": True,
        },
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    return data


def fmt_tavily(data: dict, query: str) -> str:
    results = data.get("results", [])
    answer = data.get("answer") or ""
    if not results:
        return "_Tavily 无结果_"
    lines = []
    if answer:
        lines.append(f"**🤖 AI 摘要**：{answer}\n")
    for i, it in enumerate(results, 1):
        title = it.get("title") or "_无标题_"
        url = it.get("url", "")
        content = (it.get("content") or "").strip()[:400]
        score = it.get("score", 0)
        lines.append(
            f"### {i}. [{title}]({url})\n\n"
            f"📊 相关度：{score:.2f}\n\n"
            f"{content}{'...' if len(it.get('content', '')) > 400 else ''}\n"
        )
    return "\n---\n\n".join(lines)


# ── Reddit ────────────────────────────────────────────────
def search_reddit(query: str, n: int = 10, subreddit: str | None = None,
                  sort: str = "top", time_filter: str = "week") -> list[dict]:
    """Reddit 公开 JSON API（不需要 key）。sort: relevance/top/new。time: hour/day/week/month/year/all"""
    headers = {"User-Agent": "MutiExpert-WebSearch/1.0"}
    if subreddit:
        url = f"https://www.reddit.com/r/{subreddit}/search.json"
        params = {"q": query, "sort": sort, "t": time_filter,
                  "limit": str(n), "restrict_sr": "on"}
    else:
        url = "https://www.reddit.com/search.json"
        params = {"q": query, "sort": sort, "t": time_filter, "limit": str(n)}
    log(f"[reddit] GET {url} params={params}")
    r = httpx.get(url, headers=headers, params=params, timeout=30)
    r.raise_for_status()
    posts = r.json().get("data", {}).get("children", [])
    return [p["data"] for p in posts[:n]]


def fmt_reddit(items: list[dict], query: str) -> str:
    if not items:
        return "_Reddit 无结果_"
    lines = []
    for i, it in enumerate(items, 1):
        title = it.get("title") or "_无标题_"
        url = "https://reddit.com" + (it.get("permalink") or "")
        score = it.get("score", 0)
        comments = it.get("num_comments", 0)
        sub = it.get("subreddit", "")
        author = it.get("author", "")
        text = (it.get("selftext") or "").strip()[:300]
        lines.append(
            f"### {i}. [{title}]({url})\n\n"
            f"⬆ **{score:,}** · 💬 {comments} · 👤 u/{author} · r/{sub}\n\n"
            f"{text}{'...' if len(it.get('selftext', '')) > 300 else ''}\n"
        )
    return "\n---\n\n".join(lines)


# ── main ──────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(description="精简版 web 搜索：GitHub / Tavily / Reddit")
    p.add_argument("--query", "-q", required=True, help="搜索关键词")
    p.add_argument("--provider", "-p", default="github",
                   choices=["github", "tavily", "reddit"], help="搜索源")
    p.add_argument("-n", type=int, default=10, help="返回结果数（默认 10）")
    # GitHub 专属
    p.add_argument("--sort", default="stars",
                   help="GitHub: stars/forks/updated；Reddit: top/new/relevance")
    p.add_argument("--language", help="GitHub: 限定语言（如 python）")
    p.add_argument("--created-after", help="GitHub: YYYY-MM-DD，找近期项目")
    # Tavily 专属
    p.add_argument("--depth", default="basic", choices=["basic", "advanced"],
                   help="Tavily 搜索深度")
    # Reddit 专属
    p.add_argument("--subreddit", help="Reddit: 限定 subreddit（如 MachineLearning）")
    p.add_argument("--time", default="week",
                   help="Reddit: hour/day/week/month/year/all")
    args = p.parse_args()

    log(f"[搜索] provider={args.provider} query={args.query!r} n={args.n}")

    try:
        if args.provider == "github":
            items = search_github(
                args.query, args.n,
                sort=args.sort if args.sort in ("stars", "forks", "updated") else "stars",
                language=args.language,
                created_after=args.created_after,
            )
            body = fmt_github(items, args.query)
            count = len(items)
        elif args.provider == "tavily":
            data = search_tavily(args.query, args.n, depth=args.depth)
            body = fmt_tavily(data, args.query)
            count = len(data.get("results", []))
        else:  # reddit
            items = search_reddit(
                args.query, args.n,
                subreddit=args.subreddit,
                sort=args.sort if args.sort in ("relevance", "top", "new", "hot") else "top",
                time_filter=args.time,
            )
            body = fmt_reddit(items, args.query)
            count = len(items)
    except httpx.HTTPStatusError as e:
        log(f"[错误] HTTP {e.response.status_code}: {e.response.text[:300]}")
        print(f"# ❌ 搜索失败\n\n**{args.provider}** 返回 HTTP {e.response.status_code}\n\n```\n{e.response.text[:500]}\n```")
        sys.exit(1)
    except Exception as e:
        log(f"[错误] {type(e).__name__}: {e}")
        print(f"# ❌ 搜索失败\n\n{type(e).__name__}: {e}")
        sys.exit(1)

    log(f"[搜索] 返回 {count} 条")

    # 输出 Markdown
    icon = {"github": "🐙", "tavily": "🌐", "reddit": "👽"}[args.provider]
    print(f"# {icon} {args.provider.upper()} 搜索：{args.query}\n")
    print(f"> 共 **{count}** 条结果\n")
    print("---\n")
    print(body)


if __name__ == "__main__":
    main()
