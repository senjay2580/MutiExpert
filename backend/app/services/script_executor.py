"""Deno 沙箱脚本执行引擎 — 安全执行用户 TypeScript 脚本"""
from __future__ import annotations

import asyncio
import os
import tempfile
from dataclasses import dataclass
from app.config import get_settings


@dataclass
class ScriptResult:
    success: bool
    output: str
    error: str = ""
    timed_out: bool = False


async def execute_script(
    script_content: str,
    timeout_seconds: int = 30,
    allow_net_hosts: list[str] | None = None,
) -> ScriptResult:
    """用 Deno 沙箱执行 TypeScript 脚本"""
    settings = get_settings()

    # 写入临时文件
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".ts", delete=False, dir="/tmp"
    ) as f:
        f.write(script_content)
        script_path = f.name

    try:
        # 构建 Deno 命令 — 默认禁止所有权限，按需开放
        cmd = ["deno", "run", "--no-prompt"]

        # 网络白名单：只允许访问本机 API 和指定域名
        hosts = allow_net_hosts or [f"localhost:{8000}"]
        backend_url = settings.backend_url
        if backend_url:
            from urllib.parse import urlparse
            parsed = urlparse(backend_url)
            if parsed.hostname:
                host_port = parsed.hostname
                if parsed.port:
                    host_port += f":{parsed.port}"
                if host_port not in hosts:
                    hosts.append(host_port)

        cmd.append(f"--allow-net={','.join(hosts)}")

        # 允许读取环境变量（只读，不允许写文件/执行子进程）
        cmd.append("--allow-env")

        cmd.append(script_path)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                **os.environ,
                "API_BASE_URL": settings.backend_url,
                "API_KEY": settings.api_key or "",
            },
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return ScriptResult(
                success=False,
                output="",
                error=f"脚本执行超时（{timeout_seconds}秒）",
                timed_out=True,
            )

        stdout_text = stdout.decode("utf-8", errors="replace").strip()
        stderr_text = stderr.decode("utf-8", errors="replace").strip()

        if proc.returncode == 0:
            return ScriptResult(success=True, output=stdout_text, error=stderr_text)
        else:
            return ScriptResult(
                success=False,
                output=stdout_text,
                error=stderr_text or f"Exit code: {proc.returncode}",
            )
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass
