"""Sandbox 执行引擎 — Shell / File / Web / Python 沙箱能力"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# ── 安全策略 ──────────────────────────────────────────────────

SHELL_BLACKLIST = re.compile(
    r"\b(rm\s+-rf\s+/|mkfs|dd\s+if=|shutdown|reboot|halt|poweroff"
    r"|chmod\s+777\s+/|chown.*\s+/|mount|umount|fdisk|iptables"
    r"|systemctl|service\s|kill\s+-9\s+1\b)\b",
    re.IGNORECASE,
)


@dataclass
class SandboxResult:
    success: bool
    output: str
    error: str = ""
    timed_out: bool = False


# ── 内部工具 ──────────────────────────────────────────────────

def _get_workspace() -> str:
    return get_settings().workspace_dir


def _max_output() -> int:
    return get_settings().sandbox_max_output_size


def _safe_path(user_path: str) -> str:
    """将用户路径解析到 workspace 内，防止路径遍历。"""
    base = Path(_get_workspace()).resolve()
    target = (base / user_path).resolve()
    if not str(target).startswith(str(base)):
        raise ValueError(f"路径越界: {user_path}")
    return str(target)


def _truncate(text: str) -> str:
    limit = _max_output()
    if len(text) > limit:
        return text[:limit] + f"\n... (输出被截断，超过 {limit} 字节)"
    return text.strip()


# ── Shell 命令执行 ────────────────────────────────────────────

async def execute_shell(command: str, timeout: int = 30, cwd: str | None = None) -> SandboxResult:
    """在工作区执行 Shell 命令。"""
    if SHELL_BLACKLIST.search(command):
        return SandboxResult(success=False, output="", error=f"命令被安全策略拦截: {command[:100]}")

    work_dir = _safe_path(cwd) if cwd else _get_workspace()
    os.makedirs(work_dir, exist_ok=True)

    proc = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=work_dir,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        return SandboxResult(success=False, output="", error=f"命令执行超时（{timeout}秒）", timed_out=True)

    return SandboxResult(
        success=proc.returncode == 0,
        output=_truncate(stdout.decode("utf-8", errors="replace")),
        error=_truncate(stderr.decode("utf-8", errors="replace")),
    )


# ── 文件操作 ──────────────────────────────────────────────────

async def list_files(path: str = ".") -> SandboxResult:
    """列出工作区目录内容。"""
    try:
        target = _safe_path(path)
        os.makedirs(target, exist_ok=True)
        entries = []
        for entry in sorted(Path(target).iterdir()):
            stat = entry.stat()
            kind = "d" if entry.is_dir() else "f"
            size = stat.st_size if entry.is_file() else 0
            entries.append(f"[{kind}] {entry.name:40s} {size:>10,} bytes")
        return SandboxResult(success=True, output="\n".join(entries) if entries else "(空目录)")
    except ValueError as e:
        return SandboxResult(success=False, output="", error=str(e))
    except Exception as e:
        return SandboxResult(success=False, output="", error=str(e))


async def read_file(path: str) -> SandboxResult:
    """读取工作区文件内容。"""
    try:
        target = _safe_path(path)
        p = Path(target)
        if not p.exists():
            return SandboxResult(success=False, output="", error=f"文件不存在: {path}")
        if not p.is_file():
            return SandboxResult(success=False, output="", error=f"不是文件: {path}")
        if p.stat().st_size > 5_000_000:
            return SandboxResult(success=False, output="", error="文件超过 5MB 限制")
        content = p.read_text(encoding="utf-8", errors="replace")
        return SandboxResult(success=True, output=_truncate(content))
    except ValueError as e:
        return SandboxResult(success=False, output="", error=str(e))


async def write_file(path: str, content: str) -> SandboxResult:
    """在工作区写入文件。"""
    try:
        target = _safe_path(path)
        p = Path(target)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return SandboxResult(success=True, output=f"已写入 {path}（{len(content)} 字节）")
    except ValueError as e:
        return SandboxResult(success=False, output="", error=str(e))


async def delete_file(path: str) -> SandboxResult:
    """删除工作区中的单个文件。"""
    try:
        target = _safe_path(path)
        p = Path(target)
        if not p.exists():
            return SandboxResult(success=False, output="", error=f"文件不存在: {path}")
        if p.is_dir():
            return SandboxResult(success=False, output="", error="不支持删除目录，请使用 shell 命令")
        p.unlink()
        return SandboxResult(success=True, output=f"已删除 {path}")
    except ValueError as e:
        return SandboxResult(success=False, output="", error=str(e))


# ── 网页抓取 ──────────────────────────────────────────────────

# URL 缓存（TTL 15 分钟）
_url_cache: dict[str, tuple[float, SandboxResult]] = {}
_CACHE_TTL = 900  # 15 min


def _cache_get(url: str) -> SandboxResult | None:
    """从缓存获取，过期自动清除。"""
    entry = _url_cache.get(url)
    if entry is None:
        return None
    ts, result = entry
    if time.time() - ts > _CACHE_TTL:
        _url_cache.pop(url, None)
        return None
    return result


def _cache_set(url: str, result: SandboxResult) -> None:
    """写入缓存，顺便清理过期条目（最多保留 100 条）。"""
    now = time.time()
    _url_cache[url] = (now, result)
    if len(_url_cache) > 100:
        expired = [k for k, (ts, _) in _url_cache.items() if now - ts > _CACHE_TTL]
        for k in expired:
            _url_cache.pop(k, None)

# 已知 SPA / JS 重度渲染站点 — 直接走 Jina Reader，跳过 httpx
_SPA_DOMAINS = {
    "github.com", "gitlab.com", "bitbucket.org",
    "twitter.com", "x.com",
    "reddit.com", "www.reddit.com",
    "notion.so", "www.notion.so",
    "figma.com", "www.figma.com",
    "vercel.app",
    "app.slack.com",
}

# 浏览器级请求头，避免被服务器返回精简/空壳内容
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _is_spa_domain(url: str) -> bool:
    """检查 URL 是否属于已知 SPA 站点。"""
    host = urlparse(url).hostname or ""
    host = host.lower()
    return any(host == d or host.endswith("." + d) for d in _SPA_DOMAINS)


# GitHub URL 模式 → API 映射
_GITHUB_PATTERNS = [
    # /owner/repo/issues/123 or /owner/repo/pull/123
    (re.compile(r"github\.com/([^/]+)/([^/]+)/(issues|pull)/(\d+)"), "issue_or_pr"),
    # /owner/repo/actions/runs/123
    (re.compile(r"github\.com/([^/]+)/([^/]+)/actions/runs/(\d+)(?:/job/(\d+))?"), "actions_run"),
    # /owner/repo (repo homepage)
    (re.compile(r"github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$"), "repo"),
]


async def _try_github_api(url: str) -> SandboxResult | None:
    """如果是 GitHub URL，尝试用 API 获取结构化数据。"""
    for pattern, kind in _GITHUB_PATTERNS:
        m = pattern.search(url)
        if not m:
            continue
        try:
            return await _fetch_github_api(m, kind)
        except Exception as e:
            logger.debug("GitHub API fallback failed: %s", e)
            return None
    return None


async def _fetch_github_api(m: re.Match, kind: str) -> SandboxResult:
    """调用 GitHub API 获取结构化信息。"""
    timeout = httpx.Timeout(15.0)
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "MutiExpert-Sandbox/1.0",
    }
    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        if kind == "issue_or_pr":
            owner, repo, _, number = m.group(1), m.group(2), m.group(3), m.group(4)
            resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}/issues/{number}")
            if resp.status_code == 200:
                return _format_github_issue(resp.json(), owner, repo)
        elif kind == "actions_run":
            owner, repo, run_id = m.group(1), m.group(2), m.group(3)
            job_id = m.group(4)  # 可能为 None
            # 获取 run 信息
            resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}")
            if resp.status_code != 200:
                raise ValueError(f"GitHub API HTTP {resp.status_code}")
            run_data = resp.json()
            # 获取 jobs
            resp2 = await client.get(f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}/jobs")
            jobs_data = resp2.json() if resp2.status_code == 200 else {}
            return _format_github_actions(run_data, jobs_data, job_id)
        elif kind == "repo":
            owner, repo = m.group(1), m.group(2)
            resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
            if resp.status_code == 200:
                return _format_github_repo(resp.json())
    raise ValueError("GitHub API request failed")


def _format_github_issue(data: dict, owner: str, repo: str) -> SandboxResult:
    lines = [
        f"# [{owner}/{repo}] #{data['number']}: {data['title']}",
        f"**State**: {data['state']}  |  **Author**: {data.get('user', {}).get('login', '?')}",
        f"**Created**: {data.get('created_at', '')}  |  **Updated**: {data.get('updated_at', '')}",
    ]
    labels = [lb["name"] for lb in data.get("labels", [])]
    if labels:
        lines.append(f"**Labels**: {', '.join(labels)}")
    if data.get("body"):
        lines.append(f"\n---\n\n{data['body'][:3000]}")
    return SandboxResult(success=True, output="\n".join(lines))


def _format_github_actions(run: dict, jobs_data: dict, job_id: str | None) -> SandboxResult:
    lines = [
        f"# Actions Run #{run.get('run_number', '?')}: {run.get('display_title', run.get('name', '?'))}",
        f"**Status**: {run.get('status')}  |  **Conclusion**: {run.get('conclusion', 'N/A')}",
        f"**Branch**: {run.get('head_branch')}  |  **Event**: {run.get('event')}",
        f"**Commit**: {run.get('head_sha', '')[:8]}  |  **Created**: {run.get('created_at', '')}",
        "",
    ]
    jobs = jobs_data.get("jobs", [])
    if jobs:
        lines.append("## Jobs")
        for j in jobs:
            icon = "pass" if j.get("conclusion") == "success" else j.get("conclusion", "?")
            lines.append(f"\n### {j['name']} [{icon}] ({j.get('started_at', '')} ~ {j.get('completed_at', '')})")
            # 如果指定了 job_id，只展开该 job 的 steps
            show_steps = (job_id is None) or (str(j.get("id")) == str(job_id))
            if show_steps:
                for s in j.get("steps", []):
                    s_icon = "pass" if s.get("conclusion") == "success" else s.get("conclusion", "?")
                    lines.append(f"  - [{s_icon}] {s['name']} ({s.get('number', '')})")
    return SandboxResult(success=True, output="\n".join(lines))


def _format_github_repo(data: dict) -> SandboxResult:
    lines = [
        f"# {data['full_name']}",
        f"**Description**: {data.get('description', 'N/A')}",
        f"**Language**: {data.get('language', '?')}  |  **Stars**: {data.get('stargazers_count', 0)}  |  **Forks**: {data.get('forks_count', 0)}",
        f"**Default branch**: {data.get('default_branch', 'main')}",
        f"**Created**: {data.get('created_at', '')}  |  **Updated**: {data.get('pushed_at', '')}",
    ]
    topics = data.get("topics", [])
    if topics:
        lines.append(f"**Topics**: {', '.join(topics)}")
    if data.get("homepage"):
        lines.append(f"**Homepage**: {data['homepage']}")
    return SandboxResult(success=True, output="\n".join(lines))


async def fetch_url(url: str, mode: str = "auto", max_size: int = 2_000_000) -> SandboxResult:
    """抓取 URL 内容，智能提取正文。

    mode:
      - auto: 智能选择策略（GitHub API → SPA 走 Jina → httpx + html2text）
      - jina: 强制使用 Jina Reader API（支持 JS 渲染页面）
      - raw:  返回原始 HTML/文本，不做提取
    """
    # 1. 检查缓存
    cached = _cache_get(url)
    if cached is not None:
        return cached

    try:
        result = await _fetch_url_inner(url, mode, max_size)
        if result.success:
            _cache_set(url, result)
        return result
    except Exception as e:
        return SandboxResult(success=False, output="", error=str(e))


async def _fetch_url_inner(url: str, mode: str, max_size: int) -> SandboxResult:
    """fetch_url 的内部实现（不含缓存逻辑）。"""
    if mode == "jina":
        return await _fetch_via_jina(url)

    # auto 模式：GitHub URL 优先走 API
    if mode == "auto":
        gh_result = await _try_github_api(url)
        if gh_result is not None:
            return gh_result

    # auto 模式：已知 SPA 站点直接走 Jina
    if mode == "auto" and _is_spa_domain(url):
        return await _fetch_via_jina(url)

    # 直接抓取
    raw_html, content_type = await _fetch_raw(url, max_size)

    if mode == "raw":
        return SandboxResult(success=True, output=_truncate(raw_html))

    # auto 模式：HTML 用 html2text 提取正文
    if "html" in content_type:
        extracted = _extract_content(raw_html)
        # 提取结果太短或质量差，fallback 到 Jina
        if len(extracted) < 200 or _looks_like_spa_shell(extracted):
            jina_result = await _fetch_via_jina(url)
            if jina_result.success and len(jina_result.output) > len(extracted):
                return jina_result
        return SandboxResult(success=True, output=_truncate(extracted))

    # 非 HTML（JSON/纯文本等）直接返回
    return SandboxResult(success=True, output=_truncate(raw_html))


async def _fetch_raw(url: str, max_size: int) -> tuple[str, str]:
    """用 httpx 抓取原始内容，返回 (text, content_type)。"""
    timeout = httpx.Timeout(15.0, read=30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers=_BROWSER_HEADERS)
        if resp.status_code >= 400:
            raise ValueError(f"HTTP {resp.status_code}")
        content_type = resp.headers.get("content-type", "")
        return resp.text[:max_size], content_type


def _looks_like_spa_shell(text: str) -> bool:
    """检测提取结果是否像 SPA 空壳（大量 JS 框架关键词，极少正文）。"""
    if not text:
        return True
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if len(lines) < 5:
        return True
    # 如果大部分内容是 "Loading..." / "Sign in" 之类的占位符
    short_lines = sum(1 for ln in lines if len(ln) < 20)
    if short_lines / max(len(lines), 1) > 0.7:
        return True
    return False


def _extract_content(html: str) -> str:
    """用 BS4 预清理 + html2text 转 Markdown，保留结构化信息。"""
    try:
        from bs4 import BeautifulSoup
        import html2text

        soup = BeautifulSoup(html, "html.parser")

        # 提取元数据
        meta_lines = _extract_metadata(soup)

        # 移除无用标签
        for tag in soup(["script", "style", "nav", "aside", "noscript", "iframe", "svg"]):
            tag.decompose()

        # 优先提取 main/article 区域
        main = soup.find("main") or soup.find("article") or soup.find(attrs={"role": "main"})
        target = main if main else soup.body if soup.body else soup

        # html2text 转 Markdown
        h = html2text.HTML2Text()
        h.body_width = 0  # 不自动换行
        h.ignore_images = True
        h.ignore_emphasis = False
        h.protect_links = True
        h.unicode_snob = True
        h.skip_internal_links = False
        h.inline_links = True
        h.wrap_links = False

        md = h.handle(str(target))

        # 清理多余空行
        md = re.sub(r"\n{3,}", "\n\n", md).strip()

        if meta_lines and md:
            return "\n".join(meta_lines) + "\n\n---\n\n" + md
        return md if md else "\n".join(meta_lines)
    except ImportError:
        pass
    except Exception:
        pass
    # fallback: regex 剥离
    return _strip_html(html)


def _extract_metadata(soup) -> list[str]:
    """从 HTML head 提取页面元数据（title, description, og tags）。"""
    lines: list[str] = []
    # title
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
        if title:
            lines.append(f"**Title**: {title}")
    # meta description
    desc = soup.find("meta", attrs={"name": "description"})
    if desc and desc.get("content"):
        lines.append(f"**Description**: {desc['content'].strip()}")
    # og:title / og:description
    og_title = soup.find("meta", attrs={"property": "og:title"})
    if og_title and og_title.get("content"):
        t = og_title["content"].strip()
        if not any(t in line for line in lines):
            lines.append(f"**OG Title**: {t}")
    og_desc = soup.find("meta", attrs={"property": "og:description"})
    if og_desc and og_desc.get("content"):
        d = og_desc["content"].strip()
        if not any(d in line for line in lines):
            lines.append(f"**OG Description**: {d}")
    # canonical URL
    canonical = soup.find("link", attrs={"rel": "canonical"})
    if canonical and canonical.get("href"):
        lines.append(f"**URL**: {canonical['href']}")
    return lines


async def _fetch_via_jina(url: str) -> SandboxResult:
    """通过 Jina Reader API 抓取页面（支持 JS 渲染），返回 Markdown。"""
    jina_url = f"https://r.jina.ai/{url}"
    timeout = httpx.Timeout(30.0, read=60.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(jina_url, headers={
                "Accept": "text/markdown",
                "User-Agent": "MutiExpert-Sandbox/1.0",
            })
            if resp.status_code >= 400:
                return SandboxResult(success=False, output="", error=f"Jina Reader HTTP {resp.status_code}")
            return SandboxResult(success=True, output=_truncate(resp.text))
    except Exception as e:
        return SandboxResult(success=False, output="", error=f"Jina Reader 失败: {e}")


def _strip_html(html: str) -> str:
    """简单剥离 HTML 标签，提取文本。"""
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ── Python 代码执行 ───────────────────────────────────────────

async def execute_python(code: str, timeout: int = 30) -> SandboxResult:
    """在沙箱中执行 Python 代码片段。"""
    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".py", prefix="sandbox_")
        os.write(fd, code.encode("utf-8"))
        os.close(fd)

        proc = await asyncio.create_subprocess_exec(
            "python3", tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=_get_workspace(),
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return SandboxResult(success=False, output="", error=f"Python 执行超时（{timeout}秒）", timed_out=True)

        return SandboxResult(
            success=proc.returncode == 0,
            output=_truncate(stdout.decode("utf-8", errors="replace")),
            error=_truncate(stderr.decode("utf-8", errors="replace")),
        )
    except Exception as e:
        return SandboxResult(success=False, output="", error=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
