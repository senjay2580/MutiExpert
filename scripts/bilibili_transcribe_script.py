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
# 用户每次只需要改这一行（或在前端编辑脚本）
# ════════════════════════════════════════════════════════
BILIBILI_URL = "https://www.bilibili.com/video/BV1x2doBCEyT/?spm_id_from=333.1007.tianma.1-1-1.click"
LANG = "zh"
PROXY = None  # 容器若无外网代理则保持 None；境内服务器访问 groq.com 可能需要中转
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
DEEPSEEK_MODEL = "deepseek-v4-pro"

WHISPER_MODEL = "whisper-large-v3"
MAX_FILE_SIZE = 24 * 1024 * 1024  # Groq 25MB 限制留 1MB 余量
BILIBILI_PATTERN = re.compile(r"(bilibili\.com|b23\.tv|BV[a-zA-Z0-9]+)")

# 运行时填充
GROQ_API_KEYS: list[str] = []
BILIBILI_COOKIE: str = ""


# ── 启动时自装依赖（容器无预装） ──
# 历史坑 1：之前用 --user 装到 ~/.local/...，但当前进程 sys.path 不会重新
#         加载 user site-packages，导致 install 完仍然 ImportError。
# 历史坑 2：之前 --user 留下的 yt-dlp 旧版本即使我装新版到 global，sys.path
#         里 user 路径优先，仍然 import 旧版（B站 412 修不掉）→ 主动从
#         sys.path 移除 user 路径，并 --upgrade 强制升级 yt-dlp 到最新版。
import site as _site
_user_site = _site.getusersitepackages()
sys.path = [p for p in sys.path if _user_site not in p]


def ensure_pkg(pkg: str, import_name: str | None = None, upgrade: bool = False):
    name = import_name or pkg.replace("-", "_")
    if not upgrade:
        try:
            __import__(name)
            return
        except ImportError:
            pass
    cmd = [sys.executable, "-m", "pip", "install", "--quiet",
           "-i", "https://mirrors.aliyun.com/pypi/simple/"]
    if upgrade:
        cmd.append("--upgrade")
    cmd.append(pkg)
    subprocess.run(cmd, check=True)
    import importlib
    importlib.invalidate_caches()
    if name in sys.modules:
        del sys.modules[name]
    __import__(name)

# yt-dlp 必须 --upgrade：B 站反爬规则经常变，老版本会 412
ensure_pkg("yt-dlp", "yt_dlp", upgrade=True)
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

    if not GROQ_API_KEYS:
        raise RuntimeError("Groq key 池为空，请在 FluxFilter 的 supabase ai_config 添加 whisper-large-v3 类型 key")


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


def call_groq(audio_path: str, api_key: str) -> tuple[int, object]:
    transport = httpx.HTTPTransport(proxy=PROXY) if PROXY else None
    with open(audio_path, "rb") as f:
        files = {"file": (os.path.basename(audio_path), f, "audio/wav")}
        data = {
            "model": WHISPER_MODEL,
            "response_format": "verbose_json",
            "language": LANG,
            "temperature": "0",
        }
        client_kwargs = {"timeout": 300.0}
        if transport:
            client_kwargs["transport"] = transport
        with httpx.Client(**client_kwargs) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files=files, data=data,
            )
    return resp.status_code, resp


def transcribe_with_rotation(chunks: list[str]) -> str:
    all_text = []
    idx = 0
    for i, chunk in enumerate(chunks):
        log(f"[转录] {i+1}/{len(chunks)}")
        tried = 0
        while tried < len(GROQ_API_KEYS):
            status, resp = call_groq(chunk, GROQ_API_KEYS[idx])
            if status == 200:
                all_text.append(resp.json().get("text", ""))
                break
            if status == 429:
                log(f"[轮询] Key{idx+1} 限速，切下一个")
                idx = (idx + 1) % len(GROQ_API_KEYS)
                tried += 1
                continue
            raise RuntimeError(f"Groq {status}: {resp.text[:300]}")
        else:
            raise RuntimeError("所有 Key 都已耗尽")
    return "\n\n".join(all_text)


def polish(raw: str) -> str:
    log("[校对] DeepSeek 修正中...")
    prompt = f"""你是一位资深技术内容编辑，精通中英文混合的科技/编程领域语音转录校对。

你收到的文本来自 Whisper 语音识别引擎的原始输出。修复以下系统性缺陷：
1. 谐音乱码：把听错的中文谐音字组合还原为正确的英文/中文术语（如 "Cloud" → "Claude"，"CloudOps" → "Claude Opus"）
2. 大小写与拼写：技术产品名按官方写法（JavaScript / GitHub / Claude / Gemini）
3. 断词粘连：长段无标点文本根据语义断句、加标点、自然分段
4. 口语冗余：精简过度重复的语气词，但保留自然表达
5. 内容忠实：绝不增删实质内容、不改变原意

通读全文，按话题自然分段，段间空一行。直接输出正文，不要前言/标题/总结。

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
