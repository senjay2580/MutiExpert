---
name: web-search-plus
version: 3.0.0
description: Unified search skill with Intelligent Auto-Routing. Uses multi-signal analysis to automatically select between Serper (Google), Tavily (Research), Exa (Neural), You.com (RAG/Real-time), SearXNG (Privacy/Self-hosted), GitHub (Repos/Trending), Reddit (Community/Discussions), and Twitter/X (Social/Trending) with confidence scoring.
tags: [search, web-search, serper, tavily, exa, you, searxng, google, research, semantic-search, auto-routing, multi-provider, shopping, rag, free-tier, privacy, self-hosted, github, reddit, twitter, social, trending, community]
metadata: {"openclaw":{"requires":{"bins":["python","bash"],"env":{"SERPER_API_KEY":"optional","TAVILY_API_KEY":"optional","EXA_API_KEY":"optional","YOU_API_KEY":"optional","SEARXNG_INSTANCE_URL":"optional","GITHUB_TOKEN":"optional"},"note":"Only ONE provider key needed. GitHub/Reddit/Twitter work without keys."}}}
---

<!-- AI AGENT INSTRUCTIONS — Claude Code / Kiro MUST follow these rules -->

## 🤖 AI Agent 调用规范（必读）

当用户触发 `/web-search-plus` 或要求搜索时，**必须优先使用本 skill 的脚本**，而不是内置 WebSearch/WebFetch 工具。

### 调用方式

```bash
# 自动路由（推荐）— 脚本会根据 query 自动选 provider
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\search.py" -q "你的搜索词" -n 10

# 指定 provider
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\search.py" -p linuxdo -q "Claude Code 使用技巧"
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\search.py" -p serper -q "iPhone 16 price"
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\search.py" -p tavily -q "如何理解 transformer 原理" --depth advanced
```

### 智能预处理（Query Preprocessing）— 必须在搜索前执行

当用户输入搜索请求时，AI **必须先做预处理**再调用脚本，不要直接把原始中文 query 丢给国外 provider：

**预处理流程：**
1. **意图分析**：识别用户想搜什么（GitHub 项目？Twitter 讨论？Reddit 社区？技术教程？）
2. **拆分子搜索**：一个请求可能包含多个搜索意图，拆成独立的子搜索
3. **按 provider 翻译 query**：
   - GitHub / Twitter / Reddit → **翻译为英文关键词**（国际社区英文质量远高于中文）
   - LinuxDo / Serper(中文内容) → **保持中文**
   - Tavily / Exa → **英文为主**（学术/研究类内容英文更全）
4. **关键词分词**：提取核心关键词，去掉口语化表达
5. **并行执行**：多个子搜索用 Task 工具并行调用

**示例：**

用户输入：`"分析当下 github 热点 推特 reddit 热点讨论和项目"`

AI 预处理后拆分为 4 个并行搜索：
```bash
# GitHub — 英文关键词
python search.py -p github -q "AI agent trending 2026" --github-sort stars -n 10

# Twitter — 英文关键词
python search.py -p twitter -q "AI trending projects February 2026"

# Reddit — 英文 + 指定 subreddit
python search.py -p reddit -q "best AI projects 2026" --subreddit MachineLearning --reddit-sort top --reddit-time week

# 通用补充 — 英文
python search.py -p serper -q "GitHub trending repositories AI 2026"
```

用户输入：`"Claude Code 最佳实践和使用技巧"`

AI 预处理后：
```bash
# LinuxDo — 中文（中文社区）
python search.py -p linuxdo -q "Claude Code 使用技巧 最佳实践"

# Reddit — 英文
python search.py -p reddit -q "Claude Code best practices tips" --subreddit ClaudeAI

# GitHub — 英文
python search.py -p github -q "Claude Code awesome skills"

# Serper — 英文（英文教程质量更高）
python search.py -p serper -q "Claude Code best practices workflow 2026"
```

**关键规则：**
- 国际社区（GitHub/Twitter/Reddit/Exa/Tavily）→ 一律用英文 query
- 中文社区（LinuxDo）→ 用中文 query
- Serper → 看搜索目标：搜中文内容用中文，搜国际内容用英文
- 永远不要把中文 query 直接丢给 Reddit/Twitter，搜出来的结果会很差
- 拆分后的子搜索尽量并行执行，提高速度

### 兜底策略（Fallback）

脚本搜索后，如果出现以下情况，**必须自动使用内置 WebSearch + WebFetch 工具补充搜索**：

1. **脚本执行失败**（exit code != 0，或输出包含 `"error"`）
2. **结果数量不足**（`results` 数组长度 < 3）
3. **结果质量差**（所有 snippet 都为空或极短 < 20 字符）
4. **特定站点内容抓取需求**（用户想看帖子正文，但脚本只返回标题+链接）

兜底流程：
```
1. 先用 search.py 搜索 → 解析 JSON 输出
2. 判断结果是否充足（≥3 条且 snippet 有内容）
3. 如果不足 → 用内置 WebSearch 补充搜索（不同关键词/角度）
4. 如果用户想看具体页面内容 → 用内置 WebFetch 抓取 URL
5. 合并所有结果，去重后呈现给用户
```

### LinuxDo 帖子内容抓取（Cloudflare 绕过）

linux.do 有 Cloudflare 保护，WebFetch 会 403。当需要抓取 LinuxDo 帖子正文时，**必须使用 Playwright 抓取脚本**：

```bash
# 抓取帖子内容（JSON 格式，默认前 5 楼）
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\fetch_linuxdo.py" "https://linux.do/t/topic/1463543" --format json

# 只抓主楼
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\fetch_linuxdo.py" "https://linux.do/t/topic/1463543" --max-posts 1

# 纯文本格式
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\fetch_linuxdo.py" "https://linux.do/t/topic/1463543" --format text
```

**触发条件**：当搜索结果包含 `linux.do` URL 且用户想看帖子详情时，自动调用此脚本。

### 结果过滤规则（必须执行）

拿到搜索结果后，**必须在呈现给用户前执行以下过滤**，静默丢弃垃圾条目，不提示用户：

**1. 域名黑名单（直接丢弃）**
```
# 垃圾站/SEO 农场/盗版聚合
cnsoftnews.com, chinaz.com, php.cn, 51cto.com/zt/*,
down.52pojie.cn, xitongzhijia.net, win7zhijia.cn,
pconline.com.cn/zt/*, onlinedown.net, duote.com,
xiazaizhijia.com, downxia.com, cr173.com

# 电商导购/返利/比价（非用户主动购物意图时过滤）
什么值得买的纯广告帖（URL含 /go/ 或 /redirect/）,
taobao.com/list/*, jd.com/brand/*, jd.com/hprm/*,
jd.com/xinghao/*, world.taobao.com/category/*,
accio.com, cps.*.com

# 无关内容农场
baijiahao.baidu.com（低质量百家号，保留知名作者除外）,
mbd.baidu.com, baijiahao.baidu.com/builder/*
```

**2. 内容质量过滤（逐条检查）**
- snippet 为空或 < 15 字符 → 丢弃
- snippet 全是导航/版权/备案信息（含"京ICP""备案号""版权所有""Copyright"）→ 丢弃
- title 含明显广告词（"立减""首单""优惠券""下载安装""破解版"）且非用户购物意图 → 丢弃
- URL 含 `/redirect/`、`/go/`、`/jump?`、`/link?` 等跳转链接 → 丢弃
- 同一域名结果超过 3 条 → 只保留 score 最高的 3 条

**3. 时效性过滤**
- 如果用户 query 含年份关键词（如"2025""2026"），丢弃 date 早于 2 年前的结果
- 技术类 query（含"教程""指南""推荐""配置"），优先展示 1 年内的结果，超过 2 年的降权排到末尾
- 无 date 字段的结果不过滤，但排序靠后

**4. 去重规则**
- 同一篇文章出现在不同域名（如知乎专栏 vs 360doc 转载）→ 只保留原始来源
- title 相似度 > 80%（去掉标点/空格后比较）→ 只保留 score 更高的

### 视频资源扩展搜索（自动触发）

当 query 含以下信号词时，**必须额外执行视频搜索**，结果单独分区展示：

**触发词**：教程、怎么、如何、指南、入门、实操、演示、测评、评测、开箱、对比、vlog、装机、安装、配置、搭建、部署

**搜索方式**（并行执行，不阻塞主搜索）：

```bash
# Bilibili（B站）— 中文视频首选
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\search.py" -p serper -q "site:bilibili.com {用户query}" -n 5

# YouTube — 英文/国际视频
python "C:\Users\33813\.claude\commands\web-search-plus\scripts\search.py" -p serper -q "site:youtube.com {用户query}" -n 5
```

**如果脚本无结果，用内置工具兜底**：
```
WebSearch: "site:bilibili.com {query}"
WebSearch: "site:youtube.com {query}"
```

**视频结果过滤**（额外规则）：
- 丢弃时长 < 1 分钟的（通常是广告/预告片）
- 丢弃 title 含"合集""播放列表""playlist"的聚合页（保留单个视频）
- B站优先保留播放量高的 UP 主原创内容
- YouTube 优先保留有字幕/中文标题的

**输出格式**：
```markdown
## 📹 相关视频资源

### B站
1. **[视频标题](url)** — UP主名 · 摘要描述

### YouTube
1. **[视频标题](url)** — 频道名 · 摘要描述
```

### 输出格式要求

- 解析 search.py 的 JSON 输出，提取 `results[].title`、`results[].url`、`results[].snippet`
- **先执行过滤规则**，丢弃垃圾结果后再呈现
- 以 markdown 列表格式呈现给用户，包含标题、链接、摘要
- 视频结果单独分区展示在文章结果之后
- 如果使用了兜底，在结果末尾注明"部分结果来自补充搜索"

---

# Web Search Plus

**Stop choosing search providers. Let the skill do it for you.**

This skill connects you to 8 search providers (Serper, Tavily, Exa, You.com, SearXNG, GitHub, Reddit, Twitter/X) and automatically picks the best one for each query. Shopping question? → Google results. Research question? → Deep research engine. Community discussions? → Reddit/Twitter. Trending repos? → GitHub.

---

## ✨ What Makes This Different?

- **Just search** — No need to think about which provider to use
- **Smart routing** — Analyzes your query and picks the best provider automatically
- **8 providers, 1 interface** — Google results, research engines, neural search, RAG-optimized, privacy-first, and social platforms all in one
- **Works with just 1 key** — Start with any single provider, add more later
- **Free options available** — SearXNG is completely free (self-hosted)

---

## 🚀 Quick Start

```bash
# Interactive setup (recommended for first run)
python scripts/setup.py

# Or manual: copy config and add your keys
cp config.example.json config.json
```

The wizard explains each provider, collects API keys, and configures defaults.

---

## 🔑 API Keys

You only need **ONE** key to get started. Add more providers later for better coverage.

| Provider | Free Tier | Best For | Sign Up |
|----------|-----------|----------|---------|
| **Serper** | 2,500/mo | Shopping, prices, local, news | [serper.dev](https://serper.dev) |
| **Tavily** | 1,000/mo | Research, explanations, academic | [tavily.com](https://tavily.com) |
| **Exa** | 1,000/mo | "Similar to X", startups, papers | [exa.ai](https://exa.ai) |
| **You.com** | Limited | Real-time info, AI/RAG context | [api.you.com](https://api.you.com) |
| **SearXNG** | **FREE** ✅ | Privacy, multi-source, $0 cost | Self-hosted |
| **GitHub** | **FREE** ✅ | Repos, trending, open source | No signup needed |
| **Reddit** | **FREE** ✅ | Community discussions, opinions | No signup needed |
| **Twitter/X** | Uses Serper/Exa | Tweets, trending, social buzz | Uses existing keys |

**Setting your keys:**

```bash
# Option A: .env file (recommended)
export SERPER_API_KEY="your-key"
export TAVILY_API_KEY="your-key"

# Option B: config.json
{ "serper": { "api_key": "your-key" } }
```

---

## 🎯 When to Use Which Provider

| I want to... | Provider | Example Query |
|--------------|----------|---------------|
| Find product prices | **Serper** | "iPhone 16 Pro Max price" |
| Find restaurants/stores nearby | **Serper** | "best pizza near me" |
| Understand how something works | **Tavily** | "how does HTTPS encryption work" |
| Do deep research | **Tavily** | "climate change research 2024" |
| Find companies like X | **Exa** | "startups similar to Notion" |
| Find research papers | **Exa** | "transformer architecture papers" |
| Get real-time info | **You.com** | "latest AI regulation news" |
| Search without being tracked | **SearXNG** | anything, privately |
| Find trending repos/projects | **GitHub** | "AI agent framework stars" |
| Get community opinions | **Reddit** | "r/programming best IDE" |
| See what people are saying | **Twitter/X** | "Claude Code trending tweets" |

**Pro tip:** Just search normally! Auto-routing handles most queries correctly. Override with `-p provider` when needed.

---

## 🧠 How Auto-Routing Works

The skill looks at your query and picks the best provider:

```bash
"iPhone 16 price"              → Serper (shopping keywords)
"how does quantum computing work" → Tavily (research question)
"companies like stripe.com"    → Exa (URL detected, similarity)
"latest news on AI"            → You.com (real-time intent)
"search privately"             → SearXNG (privacy keywords)
"github trending AI repos"     → GitHub (repo search)
"r/programming best practices" → Reddit (community discussion)
"twitter Claude Code opinions" → Twitter/X (social buzz)
```

**What if it picks wrong?** Override it: `python scripts/search.py -p tavily -q "your query"`

**Debug routing:** `python scripts/search.py --explain-routing -q "your query"`

---

## 📖 Usage Examples

### Let Auto-Routing Choose (Recommended)

```bash
python scripts/search.py -q "Tesla Model 3 price"
python scripts/search.py -q "explain machine learning"
python scripts/search.py -q "startups like Figma"
```

### Force a Specific Provider

```bash
python scripts/search.py -p serper -q "weather Berlin"
python scripts/search.py -p tavily -q "quantum computing" --depth advanced
python scripts/search.py -p exa --similar-url "https://stripe.com" --category company
python scripts/search.py -p you -q "breaking tech news" --include-news
python scripts/search.py -p searxng -q "linux distros" --engines "google,bing"
```

### Social Platforms (No API Key Required)

```bash
# GitHub — trending repos, stars, forks
python scripts/search.py -p github -q "AI agent framework" --github-sort stars
python scripts/search.py -p github -q "React component library" --github-language typescript
python scripts/search.py -p github -q "new projects" --github-created ">2026-01-01"

# Reddit — community discussions, opinions
python scripts/search.py -p reddit -q "best IDE for Python" --subreddit programming
python scripts/search.py -p reddit -q "Claude vs ChatGPT" --reddit-sort top --reddit-time month

# Twitter/X — social buzz, trending opinions (uses Serper or Exa behind the scenes)
python scripts/search.py -p twitter -q "Claude Code AI agent"
python scripts/search.py -p twitter -q "React 19 release" --twitter-method exa
```

---

## ⚙️ Configuration

```json
{
  "auto_routing": {
    "enabled": true,
    "fallback_provider": "serper",
    "confidence_threshold": 0.3,
    "disabled_providers": []
  },
  "serper": {"country": "us", "language": "en"},
  "tavily": {"depth": "advanced"},
  "exa": {"type": "neural"},
  "you": {"country": "US", "include_news": true},
  "searxng": {"instance_url": "https://your-instance.example.com"}
}
```

---

## 📊 Provider Comparison

| Feature | Serper | Tavily | Exa | You.com | SearXNG | GitHub | Reddit | Twitter/X |
|---------|:------:|:------:|:---:|:-------:|:-------:|:------:|:------:|:---------:|
| Speed | ⚡⚡⚡ | ⚡⚡ | ⚡⚡ | ⚡⚡⚡ | ⚡⚡ | ⚡⚡⚡ | ⚡⚡ | ⚡⚡ |
| Factual Accuracy | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Semantic Understanding | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ | ⭐ | ⭐ |
| Full Page Content | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Shopping/Local | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Find Similar Pages | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| RAG-Optimized | ✗ | ✓ | ✗ | ✓✓ | ✗ | ✗ | ✗ | ✗ |
| Privacy-First | ✗ | ✗ | ✗ | ✗ | ✓✓ | ✗ | ✗ | ✗ |
| Community/Social | ✗ | ✗ | ✗ | ✗ | ✗ | ✓✓ | ✓✓ | ✓✓ |
| API Cost | $$ | $$ | $$ | $ | **FREE** | **FREE** | **FREE** | Uses key |

---

## ❓ Common Questions

### Do I need API keys for all providers?
**No.** You only need keys for providers you want to use. Start with one (Serper recommended), add more later.

### Which provider should I start with?
**Serper** — fastest, cheapest, largest free tier (2,500 queries/month), and handles most queries well.

### What if I run out of free queries?
The skill automatically falls back to your other configured providers. Or switch to SearXNG (unlimited, self-hosted).

### How much does this cost?
- **Free tiers:** 2,500 (Serper) + 1,000 (Tavily) + 1,000 (Exa) = 4,500+ free searches/month
- **SearXNG:** Completely free (just ~$5/mo if you self-host on a VPS)
- **Paid plans:** Start around $10-50/month depending on provider

### Is SearXNG really private?
**Yes, if self-hosted.** You control the server, no tracking, no profiling. Public instances depend on the operator's policy.

### How do I set up SearXNG?
```bash
# Docker (5 minutes)
docker run -d -p 8080:8080 searxng/searxng
```
Then enable JSON API in `settings.yml`. See [docs.searxng.org](https://docs.searxng.org/admin/installation.html).

### Why did it route my query to the "wrong" provider?
Sometimes queries are ambiguous. Use `--explain-routing` to see why, then override with `-p provider` if needed.

---

## 🔄 Automatic Fallback

If one provider fails (rate limit, timeout, error), the skill automatically tries the next provider. You'll see `routing.fallback_used: true` in the response when this happens.

---

## 📤 Output Format

```json
{
  "provider": "serper",
  "query": "iPhone 16 price",
  "results": [{"title": "...", "url": "...", "snippet": "...", "score": 0.95}],
  "routing": {
    "auto_routed": true,
    "provider": "serper",
    "confidence": 0.78,
    "confidence_level": "high"
  }
}
```

---

## ⚠️ Important Note

**Tavily, Serper, and Exa are NOT core OpenClaw providers.**

❌ Don't modify `~/.openclaw/openclaw.json` for these  
✅ Use this skill's scripts — keys auto-load from `.env`

---

## 📚 More Documentation

- **[FAQ.md](FAQ.md)** — Detailed answers to more questions
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — Fix common errors
- **[README.md](README.md)** — Full technical reference

---

## 🔗 Quick Links

- [Serper](https://serper.dev) — Google Search API
- [Tavily](https://tavily.com) — AI Research Search
- [Exa](https://exa.ai) — Neural Search
- [You.com](https://api.you.com) — RAG/Real-time Search
- [SearXNG](https://docs.searxng.org) — Privacy-First Meta-Search
