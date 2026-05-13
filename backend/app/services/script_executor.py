"""脚本执行引擎 — 支持 Deno (TypeScript) 和 Python 沙箱执行"""
from __future__ import annotations

import asyncio
import json
import os
import re
import tempfile
from dataclasses import dataclass, field
from app.config import get_settings


@dataclass
class ScriptResult:
    success: bool
    output: str
    error: str = ""
    timed_out: bool = False
    warnings: list[str] = field(default_factory=list)


def apply_script_params(
    script_content: str,
    params: dict[str, object] | None,
    parameters_schema: list[dict] | None = None,
) -> tuple[str, dict[str, str]]:
    """把命名参数注入到脚本里，返回 (rewritten_script, env_overrides)。

    - 占位符 `{{name}}` → 替换为参数值（JSON 序列化，保证 string 加引号、bool/数字字面量）
    - 环境变量 `SCRIPT_<UPPER_NAME>` → 加到子进程 env，脚本里 os.environ.get(...) 取
    - parameters_schema 用于补全缺失字段的默认值（如果 schema 里有 default）
    """
    if not params:
        params = {}
    # 用 schema 的 default 补齐缺失值
    if parameters_schema:
        for p in parameters_schema:
            name = p.get("name")
            if name and name not in params and p.get("default") is not None:
                params[name] = p["default"]

    env_overrides: dict[str, str] = {}
    rewritten = script_content
    for name, value in params.items():
        if not isinstance(name, str) or not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name):
            continue
        # env: SCRIPT_NAME（保留原值的字符串形式，None/容器类型走 JSON）
        if isinstance(value, (str, int, float, bool)):
            env_overrides[f"SCRIPT_{name.upper()}"] = str(value)
        else:
            env_overrides[f"SCRIPT_{name.upper()}"] = json.dumps(value, ensure_ascii=False)

        # 占位符替换：{{ name }} 或 {{name}}（支持周围空格）
        placeholder = re.compile(r"\{\{\s*" + re.escape(name) + r"\s*\}\}")
        # JSON 序列化值，保证代码语法合法
        literal = json.dumps(value, ensure_ascii=False)
        rewritten = placeholder.sub(lambda _m, lit=literal: lit, rewritten)

    # 把所有参数 JSON 也注入 SCRIPT_PARAMS_JSON，方便脚本一次性拿全
    if params:
        env_overrides["SCRIPT_PARAMS_JSON"] = json.dumps(params, ensure_ascii=False)
    return rewritten, env_overrides


async def execute_script(
    script_content: str,
    timeout_seconds: int = 30,
    script_type: str = "typescript",
    allow_net_hosts: list[str] | None = None,
    extra_env: dict[str, str] | None = None,
    extra_args: list[str] | None = None,
    params: dict[str, object] | None = None,
    parameters_schema: list[dict] | None = None,
) -> ScriptResult:
    """根据 script_type 分发到对应执行器。
    - extra_args 作为命令行参数追加到子进程（脚本里 sys.argv / argparse 读取）
    - params 是命名参数 dict（脚本 parameters 定义对应的实际值）
    - parameters_schema 是脚本的参数定义列表（用于补 default）
    """
    if params is not None or parameters_schema:
        script_content, param_env = apply_script_params(script_content, params, parameters_schema)
        merged_env = dict(extra_env or {})
        # 调用方显式传入的 extra_env 优先级最高，覆盖参数注入
        for k, v in param_env.items():
            merged_env.setdefault(k, v)
        extra_env = merged_env

    if script_type == "python":
        return await _execute_python(script_content, timeout_seconds, extra_env, extra_args)
    return await _execute_deno(script_content, timeout_seconds, allow_net_hosts, extra_env, extra_args)


def _build_script_env(extra_env: dict[str, str] | None = None) -> dict[str, str]:
    """构建脚本执行环境变量"""
    settings = get_settings()
    env = {
        **os.environ,
        "API_BASE_URL": settings.backend_url,
        "API_KEY": settings.api_key or "",
    }
    if extra_env:
        env.update(extra_env)
    return env


async def _execute_deno(
    script_content: str,
    timeout_seconds: int = 30,
    allow_net_hosts: list[str] | None = None,
    extra_env: dict[str, str] | None = None,
    extra_args: list[str] | None = None,
) -> ScriptResult:
    """用 Deno 沙箱执行 TypeScript 脚本"""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".ts", delete=False, dir="/tmp"
    ) as f:
        f.write(script_content)
        script_path = f.name

    try:
        cmd = ["deno", "run", "--no-prompt", "--allow-net", "--allow-env", script_path]
        # Deno 命令行参数在脚本路径后面，用 -- 分隔传给脚本
        if extra_args:
            cmd.append("--")
            cmd.extend(extra_args)
        return await _run_process(cmd, timeout_seconds, extra_env)
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass


async def _execute_python(
    script_content: str,
    timeout_seconds: int = 30,
    extra_env: dict[str, str] | None = None,
    extra_args: list[str] | None = None,
) -> ScriptResult:
    """用 Python 执行用户脚本。extra_args 直接附加到 sys.argv"""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, dir="/tmp", encoding="utf-8"
    ) as f:
        f.write(script_content)
        script_path = f.name

    try:
        cmd = ["python3", script_path]
        if extra_args:
            cmd.extend(extra_args)
        return await _run_process(cmd, timeout_seconds, extra_env)
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass


async def _run_process(
    cmd: list[str],
    timeout_seconds: int,
    extra_env: dict[str, str] | None = None,
) -> ScriptResult:
    """通用子进程执行，捕获 stdout/stderr + 超时处理"""
    script_env = _build_script_env(extra_env)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=script_env,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        proc.kill()
        # 超时也尽量读取已写入 buffer 的 stdout/stderr，方便定位卡在哪一步
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5)
        except asyncio.TimeoutError:
            stdout, stderr = b"", b""
        timeout_marker = f"\n\n[脚本执行超时（{timeout_seconds}秒）被强制终止 — 上面是超时前的输出]"
        return ScriptResult(
            success=False,
            output=stdout.decode("utf-8", errors="replace").strip(),
            error=(stderr.decode("utf-8", errors="replace").strip() + timeout_marker),
            timed_out=True,
        )

    stdout_text = stdout.decode("utf-8", errors="replace").strip()
    stderr_text = stderr.decode("utf-8", errors="replace").strip()

    if proc.returncode == 0:
        return ScriptResult(success=True, output=stdout_text, error=stderr_text)
    return ScriptResult(
        success=False,
        output=stdout_text,
        error=stderr_text or f"Exit code: {proc.returncode}",
    )
