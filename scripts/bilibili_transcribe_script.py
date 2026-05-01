#!/usr/bin/env python3
"""
B站视频转录脚本 — MutiExpert 脚本系统版
此文件的全部内容会被作为 script_content 上传到 MutiExpert，
通过 /api/v1/scripts/{id}/test 或定时任务执行。

执行环境：python:3.11-slim 容器（无 ffmpeg/yt-dlp，需自装）
输出方式：直接 print Markdown 到 stdout，scheduler 自动送飞书。
"""

import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# ════════════════════════════════════════════════════════
# 运行时参数（优先级：环境变量 > 默认值）
# AI 通过 create_scripts_by_id_test 调用时传 {"env": {"BILIBILI_URL": "..."}}
# 即可切换视频，无需改 script_content。
# ════════════════════════════════════════════════════════
BILIBILI_URL = os.environ.get(
    "BILIBILI_URL",
    "https://www.bilibili.com/video/BV1SkNJeCEy4/?spm_id_from=333.337.search-card.all.click",
)
LANG = os.environ.get("LANG_CODE", "zh")
PROXY = os.environ.get("HTTP_PROXY") or None
# ════════════════════════════════════════════════════════

# ── Supabase（FluxFilter 项目，存了 Groq key 池 + B站 cookie） ──
# 启动时动态拉取，避免硬编码过期或耗尽。supabase ANON_KEY 受 RLS 控制，
# 仅能读 ai_config（whisper-large-v3*）+ user 表，符合 FluxFilter 的安全策略。
SUPABASE_URL = "https://slddpmqvawlqlqggcbfe.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZGRwbXF2YXdscWxxZ2djYmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjc3MjgsImV4cCI6MjA4MDk0MzcyOH0.Vni6mgtPZTKO6t-BhG2C7LQgXGZUNFySkdLKrRSYDdU"
SUPABASE_USER_ID = "b3cc2a9b-b50b-4684-aad1-c1e4c6d1e29f"  # senjay 用户

# ── DeepSeek（校对，硬编码） ──
DEEPSEEK_API_KEY = "sk-PLACEHOLDER_REPLACE_BEFORE_UPLOAD"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-v4-pro"  # 实测 flash 推理深度不够：跟着谐音表反而过度改写，输出大量 🎼 符号 + 把 "Haiku/Sonnet/Opus" 全删了。pro 慢但稳。

# ── SiliconFlow 语音识别（境内服务，替代 Groq——Groq 在国内 IP 直连 403） ──
# 模型 FunAudioLLM/SenseVoiceSmall：阿里达摩院开源的中文语音识别，速度快质量好
SILICONFLOW_API_KEY = "sk-PLACEHOLDER_SILICONFLOW"
SILICONFLOW_TRANSCRIBE_URL = "https://api.siliconflow.cn/v1/audio/transcriptions"
SILICONFLOW_MODEL = "FunAudioLLM/SenseVoiceSmall"

MAX_FILE_SIZE = 24 * 1024 * 1024  # 单文件转录上限（多分段）
BILIBILI_PATTERN = re.compile(r"(bilibili\.com|b23\.tv|BV[a-zA-Z0-9]+)")

# 运行时填充
GROQ_API_KEYS: list[str] = []
BILIBILI_COOKIE: str = ""


# ── 启动时自装依赖（容器无预装） ──
# 历史坑：B站反爬随版本更新，必须用最新 yt-dlp。但之前 --user 装的旧版
# 残留在 ~/.local/...，即使 pip install --upgrade，新版也可能装回 user 路径。
# 解决：force_reinstall 模式 = 先 pip uninstall -y 清所有位置的旧版，
# 再用 --break-system-packages 强制装到全局 site-packages，确保 import 新版。
def _pip_run(args: list[str]) -> tuple[int, str]:
    cmd = [sys.executable, "-m", "pip", *args, "-i", "https://mirrors.aliyun.com/pypi/simple/"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, (r.stderr or r.stdout)


def ensure_pkg(pkg: str, import_name: str | None = None, force_reinstall: bool = False):
    name = import_name or pkg.replace("-", "_")
    if not force_reinstall:
        try:
            __import__(name)
            return
        except ImportError:
            pass
    if force_reinstall:
        # 静默卸所有位置的旧版（user / global / venv），不报错
        subprocess.run(
            [sys.executable, "-m", "pip", "uninstall", "-y", pkg],
            capture_output=True,
        )
    # 装最新版。--break-system-packages 兜底 PEP 668 容器（Debian 12+ 的 EXTERNALLY-MANAGED）
    rc, out = _pip_run(["install", "--break-system-packages", pkg])
    if rc != 0:
        # 兜底再试不带 --break-system-packages（老版 pip 不认这个 flag）
        rc, out = _pip_run(["install", pkg])
        if rc != 0:
            raise RuntimeError(f"pip install {pkg} failed: {out[-500:]}")

    # 装完后让 site / sys.modules 都重新加载
    import importlib
    import site as _site
    importlib.reload(_site)
    importlib.invalidate_caches()
    if name in sys.modules:
        del sys.modules[name]
    __import__(name)

# 这些包已预装在 backend 容器（pyproject.toml 里），ensure_pkg 会立刻 import 跳过 install
ensure_pkg("yt-dlp", "yt_dlp")
ensure_pkg("imageio-ffmpeg", "imageio_ffmpeg")
ensure_pkg("httpx")

import httpx
import imageio_ffmpeg
import yt_dlp

FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()


def log(msg: str):
    """日志走 stderr，stdout 留给最终 Markdown"""
    print(msg, file=sys.stderr, flush=True)


def is_url(s: str) -> bool:
    return s.startswith(("http://", "https://")) or bool(BILIBILI_PATTERN.search(s))


# ── 从 supabase 动态拉 Groq key 池 + B 站 cookie ──
def fetch_supabase_secrets():
    """启动时调用，填充 GROQ_API_KEYS 和 BILIBILI_COOKIE 全局变量。
    cookie 从 FluxFilter 的 user 表里读，过期就重新登录 FluxFilter 即可。"""
    global GROQ_API_KEYS, BILIBILI_COOKIE
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    with httpx.Client(timeout=20.0) as client:
        # Groq keys（model_id 包含 whisper-large-v3 系列）
        r = client.get(
            f"{SUPABASE_URL}/rest/v1/ai_config"
            "?select=api_key,model_id"
            "&model_id=in.(whisper-large-v3,whisper-large-v3-turbo)",
            headers=headers,
        )
        r.raise_for_status()
        GROQ_API_KEYS = [row["api_key"] for row in r.json() if row.get("api_key")]
        log(f"[supabase] 拉到 {len(GROQ_API_KEYS)} 个 Groq key")

        # B 站 cookie
        r = client.get(
            f"{SUPABASE_URL}/rest/v1/user"
            f"?select=bilibili_cookie&id=eq.{SUPABASE_USER_ID}",
            headers=headers,
        )
        r.raise_for_status()
        rows = r.json()
        if rows and rows[0].get("bilibili_cookie"):
            BILIBILI_COOKIE = rows[0]["bilibili_cookie"]
            log(f"[supabase] 拉到 B站 cookie，长度 {len(BILIBILI_COOKIE)} 字节")
        else:
            log("[supabase] 警告：未拉到 B站 cookie，B 站下载可能 412")

    # Groq 在国内 IP 直连 403，已切换到 SiliconFlow（境内）。
    # GROQ_API_KEYS 为空也不报错——保留 supabase 拉取仅作历史兼容。


def cookie_str_to_netscape_file(cookie_str: str, out_path: str):
    """yt-dlp 需要 Netscape 格式的 cookies 文件。
    把 'k1=v1; k2=v2' 形式转成 cookies.txt 格式。"""
    lines = ["# Netscape HTTP Cookie File"]
    for pair in cookie_str.split(";"):
        pair = pair.strip()
        if not pair or "=" not in pair:
            continue
        k, v = pair.split("=", 1)
        # 字段：domain, includeSubdomain, path, secure, expiry, name, value
        lines.append(f".bilibili.com\tTRUE\t/\tFALSE\t2147483647\t{k.strip()}\t{v.strip()}")
    Path(out_path).write_text("\n".join(lines) + "\n", encoding="utf-8")


def download_audio(url: str, tmp_dir: str) -> tuple[str, str]:
    """用 yt-dlp Python API 下载（仅音频流），返回 (文件路径, 标题)"""
    log(f"[下载] {url}")
    output_template = os.path.join(tmp_dir, "%(title).80s.%(ext)s")
    ydl_opts = {
        "format": "ba/b",
        "noplaylist": True,
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        # B 站反爬三件套：Referer + 合法 UA + cookies（buvid3 / SESSDATA / bili_jct）
        # 缺 cookie 经常 412 Precondition Failed
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/",
        },
    }
    if PROXY:
        ydl_opts["proxy"] = PROXY
    if BILIBILI_COOKIE:
        cookie_file = os.path.join(tmp_dir, "cookies.txt")
        cookie_str_to_netscape_file(BILIBILI_COOKIE, cookie_file)
        ydl_opts["cookiefile"] = cookie_file
        log("[下载] 使用 B 站 cookie 认证")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title", "untitled")
        filename = ydl.prepare_filename(info)

    if not os.path.isfile(filename):
        # 后备：扫目录
        files = list(Path(tmp_dir).glob("*"))
        if not files:
            raise RuntimeError("yt-dlp 下载完成但未找到文件")
        filename = str(max(files, key=lambda f: f.stat().st_mtime))

    size_mb = os.path.getsize(filename) / 1024 / 1024
    log(f"[下载] 完成: {Path(filename).name} ({size_mb:.1f} MB)")
    return filename, title


def extract_audio(video_path: str, tmp_dir: str) -> str:
    """ffmpeg 提取 16kHz mono WAV"""
    audio_path = os.path.join(tmp_dir, "audio.wav")
    log("[音频] 提取中...")
    cmd = [
        FFMPEG_BIN, "-i", video_path,
        "-vn", "-ar", "16000", "-ac", "1",
        "-acodec", "pcm_s16le", "-y", audio_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 失败: {result.stderr[-500:]}")
    log(f"[音频] {os.path.getsize(audio_path)/1024/1024:.1f} MB")
    return audio_path


def split_audio(audio_path: str, tmp_dir: str, chunk_seconds: int = 600) -> list[str]:
    if os.path.getsize(audio_path) <= MAX_FILE_SIZE:
        return [audio_path]
    log(f"[分段] 文件过大，按 {chunk_seconds}s 切段")
    pattern = os.path.join(tmp_dir, "chunk_%03d.wav")
    cmd = [
        FFMPEG_BIN, "-i", audio_path,
        "-f", "segment", "-segment_time", str(chunk_seconds),
        "-c", "copy", "-y", pattern,
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    chunks = sorted(Path(tmp_dir).glob("chunk_*.wav"))
    log(f"[分段] {len(chunks)} 段")
    return [str(c) for c in chunks]


def call_siliconflow(audio_path: str) -> tuple[int, object]:
    """SiliconFlow 兼容 OpenAI Whisper API 接口。
    境内服务，避开 Groq 在国内 IP 被 403 Forbidden 的地理限制。"""
    transport = httpx.HTTPTransport(proxy=PROXY) if PROXY else None
    with open(audio_path, "rb") as f:
        files = {"file": (os.path.basename(audio_path), f, "audio/wav")}
        data = {"model": SILICONFLOW_MODEL}
        client_kwargs = {"timeout": 300.0}
        if transport:
            client_kwargs["transport"] = transport
        with httpx.Client(**client_kwargs) as client:
            resp = client.post(
                SILICONFLOW_TRANSCRIBE_URL,
                headers={"Authorization": f"Bearer {SILICONFLOW_API_KEY}"},
                files=files, data=data,
            )
    return resp.status_code, resp


def transcribe_with_rotation(chunks: list[str]) -> str:
    """SiliconFlow 单 key 即可，函数名保持兼容旧调用。"""
    all_text = []
    for i, chunk in enumerate(chunks):
        log(f"[转录] {i+1}/{len(chunks)}")
        status, resp = call_siliconflow(chunk)
        if status == 200:
            all_text.append(resp.json().get("text", ""))
        else:
            raise RuntimeError(f"SiliconFlow {status}: {resp.text[:300]}")
    return "\n\n".join(all_text)


def polish(raw: str) -> str:
    log("[校对] DeepSeek 修正中...")
    # 用显式映射表代替"靠模型推理判断"，让 v4-flash 不靠思考也能修对
    # （v4-flash 推理深度不足，单纯描述任务它判断不出 "CloudOps" 是 "Claude Opus"，
    #  但给它一张表让它做查找替换就能精准修复）
    prompt = f"""你是 Whisper 语音转录后处理编辑。Whisper 把英文术语听成的中文谐音必须按下表替换：

| Whisper 误识 | 正确术语 |
|---|---|
| Cloud / 克劳德 | Claude |
| CloudOps / 克劳德 Ops | Claude Opus |
| Hiku / 嗨库 / 海库 | Haiku |
| Sonic / 索尼克 / 索奈特 | Sonnet |
| Genimini / 杰明尼 / 杰米尼 | Gemini |
| Open AI 的 | OpenAI |
| GPT-five / GPT 五 | GPT-5 |
| 卡德 / 卡尔德 | Cursor |

任务：
1. 严格按上表替换所有出现的谐音词（重要！这是必修项）
2. 其它技术产品名按官方写法（JavaScript / GitHub / Python / VSCode 等）
3. 长段无标点文本根据语义断句、加标点、按话题自然分段
4. 精简重复的语气词（"就是说""然后然后"），但保留自然表达
5. 绝不增删实质内容、不改变原意

直接输出修正后的正文，不要前言/标题/解释。段间空一行。

## 原文
{raw}"""
    transport = httpx.HTTPTransport(proxy=PROXY) if PROXY else None
    client_kwargs = {"timeout": 180.0}
    if transport:
        client_kwargs["transport"] = transport
    try:
        with httpx.Client(**client_kwargs) as client:
            resp = client.post(
                DEEPSEEK_BASE_URL,
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 8192,
                },
            )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
        log(f"[校对] DeepSeek {resp.status_code}，跳过校对")
        return raw
    except Exception as e:
        log(f"[校对] 异常: {e}，跳过")
        return raw


def main():
    if not is_url(BILIBILI_URL):
        print("ERROR: BILIBILI_URL 不是合法链接", file=sys.stderr)
        sys.exit(1)

    fetch_supabase_secrets()

    with tempfile.TemporaryDirectory(prefix="vtrans_") as tmp:
        media_path, title = download_audio(BILIBILI_URL, tmp)
        audio = extract_audio(media_path, tmp)
        chunks = split_audio(audio, tmp)
        raw = transcribe_with_rotation(chunks)
        polished = polish(raw)

    # ── 输出 Markdown 到 stdout（scheduler 会捕获并送飞书） ──
    print(f"# {title}")
    print()
    print(f"> **转录时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"> **来源**: {BILIBILI_URL}")
    print(f"> **语言**: {LANG}")
    print()
    print("---")
    print()
    print(polished)


if __name__ == "__main__":
    main()
