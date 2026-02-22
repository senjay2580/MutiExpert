"""Sandbox 执行引擎 — Shell / File / Web / Python 沙箱能力"""
from __future__ import annotations

import asyncio
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import get_settings

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

async def fetch_url(url: str, mode: str = "auto", max_size: int = 2_000_000) -> SandboxResult:
    """抓取 URL 内容，智能提取正文。

    mode:
      - auto: 先用 httpx + trafilatura 提取；若内容过少则 fallback 到 Jina Reader
      - jina: 强制使用 Jina Reader API（支持 JS 渲染页面）
      - raw:  返回原始 HTML/文本，不做提取
    """
    try:
        if mode == "jina":
            return await _fetch_via_jina(url)

        # 先尝试直接抓取
        raw_html, content_type = await _fetch_raw(url, max_size)

        if mode == "raw":
            return SandboxResult(success=True, output=_truncate(raw_html))

        # auto 模式：HTML 用 trafilatura 提取正文
        if "html" in content_type:
            extracted = _extract_content(raw_html)
            # 提取结果太短（<100字符），可能是 SPA 空壳，fallback 到 Jina
            if len(extracted) < 100:
                jina_result = await _fetch_via_jina(url)
                if jina_result.success and len(jina_result.output) > len(extracted):
                    return jina_result
            return SandboxResult(success=True, output=_truncate(extracted))

        # 非 HTML（JSON/纯文本等）直接返回
        return SandboxResult(success=True, output=_truncate(raw_html))
    except Exception as e:
        return SandboxResult(success=False, output="", error=str(e))


async def _fetch_raw(url: str, max_size: int) -> tuple[str, str]:
    """用 httpx 抓取原始内容，返回 (text, content_type)。"""
    timeout = httpx.Timeout(15.0, read=30.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "MutiExpert-Sandbox/1.0"})
        if resp.status_code >= 400:
            raise ValueError(f"HTTP {resp.status_code}")
        content_type = resp.headers.get("content-type", "")
        return resp.text[:max_size], content_type


def _extract_content(html: str) -> str:
    """用 BeautifulSoup 智能提取正文，fallback 到 regex 剥离。"""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        # 移除无用标签
        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe"]):
            tag.decompose()
        # 优先提取 main/article 区域
        main = soup.find("main") or soup.find("article") or soup.find(attrs={"role": "main"})
        target = main if main else soup.body if soup.body else soup
        text = target.get_text(separator="\n", strip=True)
        if text:
            return text
    except Exception:
        pass
    # fallback: regex 剥离
    return _strip_html(html)


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
