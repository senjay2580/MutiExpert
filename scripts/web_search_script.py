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
def search_github(
    query: str, n: int = 10, sort: str = "stars", order: str = "desc",
    language: str | None = None,
    created_after: str | None = None, created_before: str | None = None,
    pushed_after: str | None = None,
    min_stars: int | None = None, max_stars: int | None = None,
    min_forks: int | None = None,
    topic: str | None = None,
    license_: str | None = None,
    in_field: str | None = None,
    user: str | None = None, org: str | None = None,
    exclude_fork: bool = False, exclude_archived: bool = False,
    raw_q: str | None = None,
) -> list[dict]:
    """GitHub repo search 全 qualifier 支持。
    raw_q 不为空时直接用作 q 参数（GitHub 完整搜索语法），覆盖其它过滤器。
    https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    if raw_q:
        q_str = raw_q
    else:
        parts: list[str] = [query] if query else []
        if in_field:
            parts.append(f"in:{in_field}")
        if language:
            parts.append(f"language:{language}")
        if created_after:
            parts.append(f"created:>{created_after}")
        if created_before:
            parts.append(f"created:<{created_before}")
        if pushed_after:
            parts.append(f"pushed:>{pushed_after}")
        if min_stars is not None:
            if max_stars is not None:
                parts.append(f"stars:{min_stars}..{max_stars}")
            else:
                parts.append(f"stars:>={min_stars}")
        if min_forks is not None:
            parts.append(f"forks:>={min_forks}")
        if topic:
            parts.append(f"topic:{topic}")
        if license_:
            parts.append(f"license:{license_}")
        if user:
            parts.append(f"user:{user}")
        if org:
            parts.append(f"org:{org}")
        if exclude_fork:
            parts.append("fork:false")
        if exclude_archived:
            parts.append("archived:false")
        q_str = " ".join(parts)

    url = (
        f"https://api.github.com/search/repositories?"
        f"q={quote(q_str)}&sort={sort}&order={order}&per_page={n}"
    )
    log(f"[github] q={q_str!r} sort={sort} order={order} n={n}")
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
def search_tavily(
    query: str, n: int = 10, depth: str = "basic",
    topic: str = "general", days: int | None = None,
    include_domains: list[str] | None = None,
    exclude_domains: list[str] | None = None,
    include_raw_content: bool = False,
    include_images: bool = False,
) -> dict:
    """Tavily Research API。
    topic: general/news（news 启用日期过滤）
    days: 限定 N 天内（仅 topic=news 生效）
    include/exclude_domains: 域名白/黑名单"""
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY 未配置——在系统设置 → 站点设置 配 tavily_api_key")
    payload: dict = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "search_depth": depth,
        "max_results": n,
        "include_answer": True,
        "topic": topic,
        "include_raw_content": include_raw_content,
        "include_images": include_images,
    }
    if days is not None:
        payload["days"] = days
    if include_domains:
        payload["include_domains"] = include_domains
    if exclude_domains:
        payload["exclude_domains"] = exclude_domains
    log(f"[tavily] topic={topic} depth={depth} days={days} query={query!r}")
    r = httpx.post("https://api.tavily.com/search", json=payload, timeout=60)
    r.raise_for_status()
    return r.json()


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
    p = argparse.ArgumentParser(
        description="Web 搜索：GitHub / Tavily / Reddit（支持丰富过滤器）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
GitHub 用法示例：
  -q "AI agent" -p github --min-stars 1000 --pushed-after 2026-01-01
  -p github --raw-q "machine learning topic:rag stars:>500 language:python"
  -q "rag" -p github --topic agentic-ai --license mit --exclude-fork --exclude-archived
  -p github --org openai --sort updated

Tavily 用法示例：
  -q "transformer 原理" -p tavily --depth advanced
  -q "AI 最新进展" -p tavily --topic news --days 7
  -q "OpenAI" -p tavily --include-domain openai.com --include-domain blog.openai.com

Reddit 用法示例：
  -q "Claude vs GPT" -p reddit --subreddit MachineLearning --reddit-sort top --time month
""",
    )
    p.add_argument("--query", "-q", default="", help="搜索关键词（用 --raw-q 时可省略）")
    p.add_argument("--provider", "-p", default="github",
                   choices=["github", "tavily", "reddit"], help="搜索源")
    p.add_argument("-n", type=int, default=10, help="返回结果数")

    # ── GitHub ──
    g = p.add_argument_group("GitHub 过滤器")
    g.add_argument("--sort", default="stars",
                   choices=["stars", "forks", "updated", "help-wanted-issues"],
                   help="GitHub 排序字段")
    g.add_argument("--order", default="desc", choices=["desc", "asc"])
    g.add_argument("--language", help="限定语言：python/rust/go/typescript ...")
    g.add_argument("--min-stars", type=int, help="最少 star 数")
    g.add_argument("--max-stars", type=int, help="最多 star 数（与 --min-stars 组合成区间）")
    g.add_argument("--min-forks", type=int, help="最少 fork 数")
    g.add_argument("--created-after", help="创建时间 YYYY-MM-DD 之后")
    g.add_argument("--created-before", help="创建时间 YYYY-MM-DD 之前")
    g.add_argument("--pushed-after", help="最近提交 YYYY-MM-DD 之后（找活跃项目）")
    g.add_argument("--topic", help="GitHub topic 标签：agentic-ai/llm/rag/...")
    g.add_argument("--license", dest="license_", help="许可证：mit/apache-2.0/...")
    g.add_argument("--in", dest="in_field", choices=["name", "description", "readme"],
                   help="只在 name/description/readme 里搜")
    g.add_argument("--user", help="限定用户")
    g.add_argument("--org", help="限定组织")
    g.add_argument("--exclude-fork", action="store_true", help="排除 fork 项目")
    g.add_argument("--exclude-archived", action="store_true", help="排除已归档项目")
    g.add_argument("--raw-q", help="直接传完整 GitHub query 字符串（覆盖以上所有过滤器）")

    # ── Tavily ──
    t = p.add_argument_group("Tavily 过滤器")
    t.add_argument("--depth", default="basic", choices=["basic", "advanced"])
    t.add_argument("--tavily-topic", dest="tavily_topic", default="general",
                   choices=["general", "news"], help="news 启用日期过滤")
    t.add_argument("--days", type=int, help="Tavily news topic：限定 N 天内")
    t.add_argument("--include-domain", action="append", default=[],
                   help="只搜这些域名（可多次：--include-domain a.com --include-domain b.com）")
    t.add_argument("--exclude-domain", action="append", default=[], help="排除域名")
    t.add_argument("--raw-content", action="store_true", help="返回原始网页内容（更全但耗 token）")
    t.add_argument("--include-images", action="store_true")

    # ── Reddit ──
    r_ = p.add_argument_group("Reddit 过滤器")
    r_.add_argument("--subreddit", help="限定 subreddit：MachineLearning/LocalLLaMA/...")
    r_.add_argument("--reddit-sort", default="top",
                    choices=["relevance", "top", "new", "hot", "comments"])
    r_.add_argument("--time", default="week",
                    choices=["hour", "day", "week", "month", "year", "all"])

    args = p.parse_args()

    if not args.query and not args.raw_q:
        log("[错误] 必须传 --query 或 --raw-q 之一")
        print("# ❌ 缺少搜索词\n\n传 `-q 关键词` 或 `--raw-q '完整 GitHub query'`")
        sys.exit(1)

    log(f"[搜索] provider={args.provider} query={args.query!r} n={args.n}")

    try:
        if args.provider == "github":
            items = search_github(
                args.query, args.n,
                sort=args.sort, order=args.order,
                language=args.language,
                created_after=args.created_after,
                created_before=args.created_before,
                pushed_after=args.pushed_after,
                min_stars=args.min_stars, max_stars=args.max_stars,
                min_forks=args.min_forks,
                topic=args.topic,
                license_=args.license_,
                in_field=args.in_field,
                user=args.user, org=args.org,
                exclude_fork=args.exclude_fork,
                exclude_archived=args.exclude_archived,
                raw_q=args.raw_q,
            )
            body = fmt_github(items, args.query or args.raw_q or "")
            count = len(items)
        elif args.provider == "tavily":
            data = search_tavily(
                args.query, args.n,
                depth=args.depth, topic=args.tavily_topic,
                days=args.days,
                include_domains=args.include_domain or None,
                exclude_domains=args.exclude_domain or None,
                include_raw_content=args.raw_content,
                include_images=args.include_images,
            )
            body = fmt_tavily(data, args.query)
            count = len(data.get("results", []))
        else:  # reddit
            items = search_reddit(
                args.query, args.n,
                subreddit=args.subreddit,
                sort=args.reddit_sort,
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
