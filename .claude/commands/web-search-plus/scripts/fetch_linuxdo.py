#!/usr/bin/env python
"""
LinuxDo 帖子内容抓取脚本
使用 Playwright 绕过 Cloudflare 保护，提取 Discourse 帖子正文

Usage:
    python fetch_linuxdo.py <url> [--max-posts 5] [--format text|json]
    python fetch_linuxdo.py https://linux.do/t/topic/1463543
    python fetch_linuxdo.py https://linux.do/t/topic/1463543 --max-posts 3 --format json
"""
import sys, io, json, argparse, re, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def extract_topic_id(url: str) -> str:
    """从 URL 提取 topic ID"""
    m = re.search(r'/t/(?:topic/)?(\d+)', url)
    return m.group(1) if m else None


def fetch_with_playwright(url: str, max_posts: int = 5) -> dict:
    """用 Playwright 抓取 LinuxDo 帖子"""
    from playwright.sync_api import sync_playwright

    result = {"success": False, "url": url, "title": "", "posts": [], "error": None}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            locale="zh-CN",
        )
        page = ctx.new_page()

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Wait for Discourse post content to render
            page.wait_for_selector(".topic-post", timeout=15000)
            time.sleep(1)  # Let lazy content settle

            # Extract title
            title_el = page.query_selector("#topic-title .fancy-title, .topic-title .fancy-title, h1")
            result["title"] = title_el.inner_text().strip() if title_el else ""

            # Extract posts
            post_els = page.query_selector_all(".topic-post")
            for i, post_el in enumerate(post_els[:max_posts]):
                try:
                    author_el = post_el.query_selector(".username a, .names .username")
                    cooked_el = post_el.query_selector(".cooked")
                    likes_el = post_el.query_selector(".like-count, .actions .like-button .d-button-label")
                    date_el = post_el.query_selector(".post-date, time")

                    author = author_el.inner_text().strip() if author_el else "unknown"
                    content = cooked_el.inner_text().strip() if cooked_el else ""
                    date = date_el.get_attribute("datetime") or date_el.inner_text().strip() if date_el else ""

                    if content:
                        result["posts"].append({
                            "index": i + 1,
                            "author": author,
                            "content": content[:3000],
                            "date": date,
                        })
                except Exception:
                    continue

            result["success"] = len(result["posts"]) > 0
        except Exception as e:
            result["error"] = str(e)
        finally:
            browser.close()

    return result


def format_text(data: dict) -> str:
    """格式化为可读文本"""
    lines = []
    lines.append(f"# {data['title']}")
    lines.append(f"URL: {data['url']}")
    lines.append("")
    for post in data["posts"]:
        lines.append(f"--- Post #{post['index']} by @{post['author']} ({post['date']}) ---")
        lines.append(post["content"])
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Fetch LinuxDo post content via Playwright")
    parser.add_argument("url", help="LinuxDo topic URL")
    parser.add_argument("--max-posts", type=int, default=5, help="Max posts to extract (default: 5)")
    parser.add_argument("--format", choices=["text", "json"], default="json", help="Output format")
    args = parser.parse_args()

    if "linux.do" not in args.url:
        print(json.dumps({"success": False, "error": "Not a linux.do URL"}, ensure_ascii=False))
        sys.exit(1)

    data = fetch_with_playwright(args.url, args.max_posts)

    if args.format == "json":
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        if data["success"]:
            print(format_text(data))
        else:
            print(f"Failed: {data.get('error', 'unknown error')}")

    sys.exit(0 if data["success"] else 1)


if __name__ == "__main__":
    main()
