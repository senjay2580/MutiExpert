# MutiExpert Skills 使用指南

## 📦 已安装的 GitHub Skills

### 1. github_daily - 每日 GitHub 项目推荐

从多个优质渠道获取每日热门 GitHub 项目。

**使用方式**：

```
/github_daily
```

**参数**（可选）：

```
/github_daily count=20 language=python days=7 source=trending min_stars=1000
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `count` | 返回项目数量 | 10 |
| `language` | 编程语言过滤（python/javascript/go等） | 空（不限） |
| `days` | 最近N天内更新 | 1 |
| `source` | 渠道（trending/hellogithub/hn/trendshift/all） | all |
| `min_stars` | 最小 Stars 数 | 0 |

**示例**：

```
# 获取今日推荐（默认10个）
/github_daily

# 获取20个 Python 项目，最近7天更新，至少1000 stars
/github_daily count=20 language=python days=7 min_stars=1000

# 只从 GitHub Trending 获取
/github_daily source=trending count=15

# 获取 JavaScript 项目
/github_daily language=javascript count=20
```

**数据来源**：
- GitHub Trending（官方趋势榜）
- Trendshift（实时追踪）
- HelloGitHub（中文月刊）
- Hacker News Show HN
- 其他专业平台

---

### 2. github_miner - GitHub 项目数据挖掘

深度分析和挖掘 GitHub 项目数据，支持多维度搜索和分析。

**使用方式**：

```
/github_miner query="AI agent"
```

**参数**：

```
/github_miner query="RAG framework" count=20 language=python min_stars=500 sort_by=stars time_range=month analysis_mode=deep
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `query` | 搜索关键词（必填） | 空 |
| `count` | 返回项目数量 | 20 |
| `language` | 编程语言过滤 | 空（不限） |
| `min_stars` | 最小 Stars 数 | 100 |
| `sort_by` | 排序方式（stars/updated/created/forks） | stars |
| `time_range` | 时间范围（week/month/year/all） | all |
| `analysis_mode` | 分析模式（basic/deep/full） | basic |

**分析模式说明**：

- **basic**：快速搜索，基础信息
- **deep**：多角度搜索 + 趋势分析 + 生态分析 + 社区健康度
- **full**：完整分析 + 竞品对比 + 口碑分析 + 应用案例 + 风险评估 + 学习路径

**示例**：

```
# 基础搜索 AI agent 项目
/github_miner query="AI agent" count=20

# 深度分析 RAG 框架（Python）
/github_miner query="RAG framework" language=python analysis_mode=deep

# 全方位挖掘 LLM 工具，最近一个月，至少500 stars
/github_miner query="LLM tools" time_range=month min_stars=500 analysis_mode=full

# 按最近更新排序
/github_miner query="vector database" sort_by=updated count=15

# 新兴项目（按创建时间）
/github_miner query="AI coding assistant" sort_by=created time_range=month
```

**输出内容**（根据 analysis_mode）：

- **basic**：项目列表 + 基础信息
- **deep**：数据概览 + Top 项目详细分析 + 趋势洞察
- **full**：执行摘要 + 竞品对比矩阵 + 社区口碑 + 应用场景 + 风险评估 + 学习路径

---

## 🚀 快速开始

### 在聊天界面使用

1. 打开 MutiExpert 聊天界面
2. 输入命令，例如：
   ```
   /github_daily count=15 language=python
   ```
3. AI 会自动执行 skill 并返回结果

### 通过 API 调用

```bash
# 执行 github_daily skill
curl -X POST http://localhost:8000/api/v1/chat/{conversation_id}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "/github_daily count=20 language=python"
  }'

# 执行 github_miner skill
curl -X POST http://localhost:8000/api/v1/chat/{conversation_id}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "/github_miner query=\"AI agent\" analysis_mode=deep"
  }'
```

---

## 🔧 技术实现

### 架构

```
用户输入 (/github_daily)
    ↓
chat.py 检测 /skill 命令
    ↓
skill_executor.py 加载 YAML skill
    ↓
执行 prompt（调用 web-search-plus）
    ↓
返回结构化结果
```

### 依赖

- **web-search-plus**：多渠道搜索引擎（必需）
- **GitHub API**：提升数据准确性（可选）
- **AI 模型**：Claude/GPT 等（必需）

### 文件结构

```
skills/
├── registry.yaml           # Skills 注册表
├── github_daily.yaml       # 每日推荐 skill
├── github_miner.yaml       # 数据挖掘 skill
└── README.md              # 本文档
```

---

## 📝 注意事项

1. **API 限流**：GitHub API 有速率限制，未认证每小时 60 次
2. **执行时间**：
   - `github_daily`：约 10-30 秒
   - `github_miner` (basic)：约 10-20 秒
   - `github_miner` (deep)：约 30-60 秒
   - `github_miner` (full)：约 1-3 分钟
3. **数据准确性**：数据来自多个渠道，可能存在延迟
4. **语言参数**：使用 GitHub 官方语言标签（小写，如 `python`、`javascript`）

---

## 🐛 故障排查

### Skill 未找到

```
错误：Skill 'github_daily' not found in registry
```

**解决**：检查 `skills/registry.yaml` 是否包含该 skill

### 搜索无结果

```
错误：No results found
```

**解决**：
1. 检查关键词是否正确
2. 降低 `min_stars` 阈值
3. 扩大 `time_range` 范围

### 执行超时

```
错误：Execution timeout
```

**解决**：
1. 减少 `count` 数量
2. 使用 `basic` 模式代替 `full` 模式
3. 检查网络连接

---

## 🔄 更新日志

### v1.0.0 (2026-04-03)
- ✨ 新增 `github_daily` skill
- ✨ 新增 `github_miner` skill
- 📝 完善使用文档

---

## 📚 相关资源

- [web-search-plus 文档](../.claude/commands/web-search-plus/SKILL.md)
- [GitHub Discovery Channels](../.claude/commands/web-search-plus/references/github-discovery-channels.md)
- [MutiExpert 项目文档](../README.md)
