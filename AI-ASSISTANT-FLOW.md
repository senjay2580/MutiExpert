# MutiExpert AI 助手 — 完整消息流程文档

> 从用户发送消息到接收回显的全链路架构梳理

---

## 目录

1. [架构总览](#1-架构总览)
2. [端到端流程图](#2-端到端流程图)
3. [前端层](#3-前端层)
   - 3.1 Chat UI 页面
   - 3.2 API 调用与 SSE 流式通信
   - 3.3 流式状态管理 (StreamRegistry)
   - 3.4 全局状态 (Zustand)
4. [后端层](#4-后端层)
   - 4.1 API 入口 (chat.py)
   - 4.2 Pipeline 编排器
   - 4.3 System Prompt 构建
   - 4.4 RAG 知识检索
   - 4.5 联网搜索 (Tavily)
   - 4.6 工具系统 (BotTools + Skills)
   - 4.7 AI Provider 策略
   - 4.8 Sandbox 沙箱
5. [SSE 事件协议](#5-sse-事件协议)
6. [System Prompt 详解](#6-system-prompt-详解)
   - 6.1 组装逻辑
   - 6.2 静态常量
   - 6.3 动态能力加载
   - 6.4 运行时增强
   - 6.5 管理方式
7. [Skills 技能系统详解](#7-skills-技能系统详解)
   - 7.1 数据模型
   - 7.2 后端 CRUD API
   - 7.3 前端管理页面
   - 7.4 技能如何变成 AI 可调用工具
   - 7.5 技能执行流程
   - 7.6 文件式技能 (legacy)
   - 7.7 两套技能系统对比
8. [关键文件索引](#8-关键文件索引)

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React 19)                  │
│  AIAssistantChatPage ← streamRegistry ← chatService     │
│       ↕ Zustand (useAppStore)    ↕ TanStack Query       │
└──────────────────────── SSE ────────────────────────────┘
                          │
                    fetch POST (SSE)
                          │
┌──────────────────────── ▼ ──────────────────────────────┐
│                   Backend (FastAPI)                       │
│  chat.py → pipeline_service.py → ai_service.py          │
│              ↕            ↕           ↕                  │
│         rag_service   tools/skills  Claude/OpenAI/       │
│         (pgvector)    (executor)    DeepSeek/Qwen        │
└─────────────────────────────────────────────────────────┘
```

| 层 | 技术栈 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Zustand + Lucide Icons |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy 2 (async) + PostgreSQL 16 + pgvector |
| 通信 | SSE (Server-Sent Events) over HTTP |
| AI | Claude (Anthropic) / OpenAI (Responses API) / DeepSeek / Qwen — 策略模式 |
| 向量 | SiliconFlow Embedding + pgvector 余弦相似度 |
| 搜索 | Tavily Search API |

---

## 2. 端到端流程图

```
用户在输入框输入消息，点击发送
│
├─ 1. handleSend() (AIAssistantChatPage.tsx:602)
│     ├─ 无会话 → POST /api/v1/conversations 创建新会话
│     ├─ 收集 modes: 始终含 "tools"，可选 "knowledge" / "search"
│     └─ 调用 streamMessage()
│
├─ 2. streamMessage() (chatService.ts:136)
│     └─ fetch POST /api/v1/conversations/{id}/messages
│        body: { content, model_provider, modes }
│        Accept: text/event-stream
│
├─ 3. send_message() (chat.py:133)
│     ├─ 保存用户消息到 DB (Message 表)
│     ├─ 首条消息自动截取前50字作会话标题
│     ├─ 检测 /skill_name 命令前缀 → 改写为技能调用
│     └─ 调用 _stream_pipeline_response() → StreamingResponse
│
├─ 4. pipeline_run_stream() (pipeline_service.py:312) ← 核心编排器
│     │
│     ├─ ① build_system_prompt()
│     │     身份设定 + 行为准则 + 动态能力清单
│     │     (知识库列表 / 启用工具 / 脚本 / 定时任务 / 技能)
│     │
│     ├─ ② RAG 知识检索 (modes 含 "knowledge")
│     │     query → SiliconFlow Embedding → pgvector 余弦搜索 (top_k=5)
│     │     → 注入 system prompt
│     │     → yield event: sources
│     │
│     ├─ ③ 对话记忆 (如果启用)
│     │     memory_summary 追加到 system prompt
│     │
│     ├─ ④ 联网搜索 (modes 含 "search")
│     │     Tavily Search API → 注入 system prompt
│     │     → yield event: web_search
│     │
│     ├─ ⑤ 收集工具定义
│     │     BotTools (DB, OpenAPI 自动同步) + Skills (DB)
│     │     → 转为 OpenAI function calling 格式
│     │
│     ├─ ⑥ 工具循环 (最多 5 轮)
│     │     ├─ ai_generate() 非流式调用，带 tools 参数
│     │     ├─ 有 tool_calls？
│     │     │   ├─ BotTool → executor.py 内部 HTTP 请求自身 API
│     │     │   ├─ Skill → skill_executor.py
│     │     │   │   ├─ script 类型 → 执行 UserScript
│     │     │   │   ├─ hybrid 类型 → 执行脚本 + AI 处理
│     │     │   │   └─ prompt 类型 → 喂给 AI 作为上下文
│     │     │   ├─ yield event: tool_start / tool_result
│     │     │   └─ 结果追加到消息历史 → 继续循环
│     │     └─ 无 tool_calls → 跳出循环
│     │
│     └─ ⑦ 最终流式输出
│           ├─ DeepSeek/Qwen: 先扁平化 tool 消息 (不支持 tool 角色)
│           ├─ stream_chat() 流式生成
│           │   → yield event: chunk (文本增量)
│           │   → yield event: thinking (推理过程)
│           └─ → yield event: done (message_id + 元数据)
│                 + 保存助手消息到 DB
│                 + 异步更新对话记忆
│
├─ 5. SSE 响应流回前端
│     streamConversationRequest() (chatService.ts:71) 逐行解析
│     ├─ event:chunk     → streamRegistry.appendChunk()
│     ├─ event:thinking  → streamRegistry.appendThinking()
│     ├─ event:sources   → streamRegistry.setSources()
│     ├─ event:tool_start→ streamRegistry.addToolStart()
│     ├─ event:tool_result→ streamRegistry.updateToolResult()
│     ├─ event:web_search→ streamRegistry.setWebSearchResults()
│     ├─ event:done      → streamRegistry.markDone()
│     └─ event:error     → streamRegistry.markError()
│
└─ 6. UI 实时渲染
      streamRegistry.subscribe() → onUpdate → setMessages() → React 重渲染
      ├─ ReactMarkdown 渲染文本 (rehype-highlight 代码高亮)
      ├─ ThinkingBlock 折叠显示推理过程
      ├─ ToolCallBlock 显示工具执行状态
      └─ SourceReferences 显示 RAG 来源文档
```

---

## 3. 前端层

### 3.1 Chat UI 页面

**入口页** — `frontend/src/pages/assistant/AIAssistantPage.tsx`
- Hero 输入区 + 快捷提示词
- 模型选择下拉框
- 知识库数量徽标
- 右侧边栏：会话历史列表（搜索、置顶、重命名、删除）
- `handleSend()` → 导航到 `/assistant/chat`，携带 `{ state: { initialPrompt } }`

**聊天页** — `frontend/src/pages/assistant/AIAssistantChatPage.tsx` (1096 行)

核心状态：
| 状态 | 类型 | 说明 |
|---|---|---|
| `messages` | `ChatMessage[]` | 当前会话所有消息 |
| `isSending` | `boolean` | 是否正在流式传输 |
| `modes` | `Set<ChatMode>` | 增强模式: `knowledge` / `search` / `tools` |
| `selectedKbIds` | `UUID[]` | 选中的知识库 |
| `activeConvId` | `UUID` | 当前会话 ID |

核心操作：
| 函数 | 行号 | 说明 |
|---|---|---|
| `handleSend()` | 602 | 创建会话(如需) → streamMessage() |
| `handleRegenerate()` | 492 | 重新生成最后一条助手回复 |
| `handleStartEditMessage()` | 510 | 编辑模式 → streamEditMessage() |
| `cancelStreaming()` | 420 | 中止流式传输 |
| `toggleMode()` | 468 | 切换 knowledge/search 模式 |

消息渲染组件：
| 组件 | 文件 | 说明 |
|---|---|---|
| `ReactMarkdown` | 内联 | Markdown 渲染 + rehype-highlight 代码高亮 |
| `CodeBlock` | 内联 | 代码块 + 复制按钮 |
| `ThinkingBlock` | `components/composed/thinking-block.tsx` | 折叠式推理过程展示 |
| `ToolCallBlock` | 内联 (行 111-148) | 工具执行状态 (运行中/成功/失败) |
| `SourceReferences` | 内联 (行 79-108) | RAG 来源文档 + 相关度分数 |

输入栏 (行 876-946)：
- 文本输入框 (textarea)
- 模型选择器
- 模式切换按钮 (知识库 / 搜索)
- 发送 / 停止按钮

---

### 3.2 API 调用与 SSE 流式通信

**基础客户端** — `frontend/src/services/api.ts`
- Axios 实例，`baseURL: '/api/v1'`
- 自动附加 `X-API-Key` header

**聊天服务** — `frontend/src/services/chatService.ts`

CRUD 操作：
```typescript
chatService.listConversations()
chatService.createConversation(data)
chatService.listMessages(convId)
chatService.deleteConversation(convId)
chatService.updateConversation(convId, data)
chatService.searchConversations(query)
chatService.switchModel(convId, provider)
```

三个流式函数，均基于 `streamConversationRequest()`：
```typescript
// 发送新消息
streamMessage(convId, content, modelProvider, callbacks, modes)
  → POST /conversations/{convId}/messages

// 重新生成
streamRegenerate(convId, modelProvider, callbacks)
  → POST /conversations/{convId}/regenerate

// 编辑后重新生成
streamEditMessage(convId, messageId, content, modelProvider, callbacks)
  → POST /conversations/{convId}/messages/{messageId}/edit
```

**`streamConversationRequest()` (行 71-134) — SSE 核心解析器：**
```typescript
function streamConversationRequest(url, body, callbacks): () => void {
  // 1. 使用原生 fetch (非 axios)，支持 AbortController 取消
  // 2. 读取 response.body 为 ReadableStream
  // 3. 逐行解析 SSE 格式：
  //    "event: chunk\ndata: {"content":"..."}\n\n"
  // 4. 按 event type 分发到对应 callback
  // 5. 返回 abort 函数用于取消流
}
```

回调接口：
```typescript
interface StreamCallbacks {
  onChunk(text: string): void          // 文本增量
  onThinking(text: string): void       // 推理过程
  onSources(sources: Source[]): void   // RAG 来源
  onDone(messageId: string, meta: StreamDoneMeta): void
  onError(error: string): void
  onToolStart?(data): void             // 工具开始执行
  onToolResult?(data): void            // 工具执行结果
  onWebSearch?(data): void             // 联网搜索结果
}
```

---

### 3.3 流式状态管理 (StreamRegistry)

**文件** — `frontend/src/lib/streamRegistry.ts`

设计目的：流式状态独立于 React 组件生命周期，用户导航离开再返回时流不会中断。

核心类型：
```typescript
interface StreamEntry {
  conversationId: string
  assistantMessageId: string
  userMessage: string
  content: string           // 累积的文本内容
  thinking: string          // 累积的推理内容
  sources: MessageSource[]  // RAG 来源
  toolCalls: ToolCallEntry[] // 工具调用记录
  webSearchResults: WebSearchResult[]
  isStreaming: boolean
  abort: () => void         // 取消函数
  finalMessageId?: string
  meta?: StreamDoneMeta     // 完成元数据 (延迟/token/费用)
  error?: string
  modelUsed: string
  onUpdate?: () => void     // React 订阅回调
}
```

工作流程：
```
1. handleSend() 创建 StreamEntry → streamRegistry.registerStream()
2. SSE 回调 → streamRegistry.appendChunk() / appendThinking() / ...
3. React 组件 → streamRegistry.subscribe(convId, onUpdate)
4. onUpdate 触发 → setMessages() → React 重渲染
5. 流完成 → markDone() → subscriber 收到通知 → setIsSending(false)
6. 用户导航离开 → unsubscribe()，流继续在后台运行
7. 用户返回 → useEffect 检测 getStream(convId)，重新 subscribe
8. 流在无订阅者时完成 → _onStreamComplete → 失效 TanStack Query 缓存
```

公开 API：
| 函数 | 说明 |
|---|---|
| `registerStream(entry)` | 注册新流 |
| `getStream(convId)` | 获取活跃流 |
| `subscribe(convId, cb)` | 订阅更新 |
| `unsubscribe(convId)` | 取消订阅 |
| `appendChunk(convId, chunk)` | 追加文本 |
| `appendThinking(convId, chunk)` | 追加推理 |
| `setSources(convId, sources)` | 设置 RAG 来源 |
| `addToolStart(convId, data)` | 记录工具开始 |
| `updateToolResult(convId, data)` | 更新工具结果 |
| `setWebSearchResults(convId, results)` | 设置搜索结果 |
| `markDone(convId, messageId, meta)` | 标记完成 |
| `markError(convId, error)` | 标记错误 |
| `abortAndRemove(convId)` | 取消并清理 |

---

### 3.4 全局状态 (Zustand)

**文件** — `frontend/src/stores/useAppStore.ts`

```typescript
interface AppState {
  currentModel: ModelProvider  // 'claude' | 'openai' | 'codex' | 'deepseek' | 'qwen'
  sidebarCollapsed: boolean
  theme: string
  commandPaletteOpen: boolean
  customQuickActions: QuickAction[]
}
// 持久化到 localStorage key: 'mutiexpert-app'
```

**类型定义** — `frontend/src/types/index.ts`
```typescript
type ModelProvider = 'claude' | 'openai' | 'codex' | 'deepseek' | 'qwen'
// 以及 Conversation, Message, SourceReference, BotTool, Skill, SkillReference 等
```

---

## 4. 后端层

### 4.1 API 入口 (chat.py)

**文件** — `backend/app/api/chat.py`
**路由前缀** — `/api/v1/conversations` (在 `router.py` 中注册)

| 方法 | 路径 | 行号 | 说明 |
|---|---|---|---|
| GET | `/` | 32 | 列出所有会话 (置顶优先，按更新时间排序) |
| POST | `/` | 45 | 创建会话 |
| GET | `/search?q=` | 59 | 全文搜索会话标题和消息内容 |
| GET | `/{conv_id}` | 80 | 获取单个会话 |
| GET | `/{conv_id}/messages` | 89 | 获取会话消息列表 |
| DELETE | `/{conv_id}` | 97 | 删除会话 |
| PATCH | `/{conv_id}` | 107 | 更新会话 (标题/知识库/置顶/默认模式) |
| **POST** | **`/{conv_id}/messages`** | **133** | **发送消息 (主入口)** |
| PUT | `/{conv_id}/model` | 177 | 切换模型 |
| POST | `/{conv_id}/regenerate` | 189 | 重新生成最后回复 |
| POST | `/{conv_id}/messages/{id}/edit` | 230 | 编辑消息并重新生成 |
| GET | `/{conv_id}/memory` | 280 | 获取对话记忆 |
| PUT | `/{conv_id}/memory` | 293 | 更新对话记忆 |
| POST | `/{conv_id}/memory/refresh` | 317 | 刷新记忆摘要 |

**`send_message()` (行 133-174) — 消息发送主入口：**
```python
async def send_message(conv_id, data: MessageCreate, db):
    # 1. 加载会话
    # 2. 同步 model_provider (如果消息级别有覆盖)
    # 3. 保存用户消息到 DB
    # 4. 首条消息自动设标题 (前50字)
    # 5. 确定增强模式: data.modes or conv.default_modes or ["knowledge"]
    #    始终追加 "tools"
    # 6. 检测 /skill_name 命令前缀 → 改写消息触发技能
    # 7. return _stream_pipeline_response(...)
```

**`_stream_pipeline_response()` (行 395-504) — SSE 生成器：**
```python
async def _stream_pipeline_response(db, conv, conv_id, message, modes, memory_summary):
    # 1. 解析 provider (codex → openai)
    # 2. 加载最近 10 条历史消息
    # 3. 构建 PipelineRequest
    # 4. 遍历 pipeline_run_stream() 产出的 PipelineEvent
    # 5. 转换为 SSE 格式: "event: {type}\ndata: {json}\n\n"
    # 6. 流完成后保存助手消息到 DB
    # 7. 如果启用记忆 → 后台任务更新 memory_summary
```

---

### 4.2 Pipeline 编排器

**文件** — `backend/app/services/pipeline_service.py`

核心数据结构：
```python
@dataclass
class PipelineRequest:
    message: str                          # 用户消息
    conversation_id: UUID | None          # 会话 ID
    channel: str = "web"                  # 渠道
    provider: str = "claude"              # AI 提供商
    modes: set[str] = {"knowledge"}       # 增强模式
    knowledge_base_ids: list[UUID] = []   # 知识库 ID 列表
    history: list[dict] | None = None     # 历史消息
    max_tool_rounds: int = 5              # 工具循环最大轮数
    memory_summary: str | None = None     # 对话记忆摘要

@dataclass
class PipelineEvent:
    type: str       # text_chunk | thinking | sources | tool_start |
                    # tool_result | web_search | done | error
    data: dict
```

**`run_stream()` (行 312-410) — 核心编排逻辑：**

```
Step 1: build_system_prompt(db)
  → 身份 + 准则 + 动态能力

Step 2: if "knowledge" in modes
  → retrieve_context() → embedding → pgvector
  → build_rag_context() 注入 system prompt
  → yield PipelineEvent(type="sources")

Step 3: if memory_summary
  → 追加到 system prompt

Step 4: if "search" in modes
  → tavily_search() → 注入 system prompt
  → yield PipelineEvent(type="web_search")

Step 5: if "tools" in modes
  → _collect_tools(db) → BotTools + Skills

Step 6: Tool Loop (最多 5 轮)
  ┌─ ai_generate(messages, provider, system_prompt, tools=tools)
  │  非流式调用，获取 GenerateResult
  │
  ├─ if tool_calls:
  │    for tc in tool_calls:
  │      yield PipelineEvent(type="tool_start")
  │      result = _execute_tool_call(tc, tool_index, db)
  │      yield PipelineEvent(type="tool_result")
  │      append tool messages to history
  │    → continue loop
  │
  └─ if no tool_calls:
       yield text as final answer → return

Step 7: Final Streaming
  → DeepSeek/Qwen: _flatten_tool_messages() 扁平化
  → stream_chat(messages, provider, system_prompt)
  → yield PipelineEvent(type="text_chunk")
  → yield PipelineEvent(type="thinking")
  → yield PipelineEvent(type="done")
```

辅助函数：
| 函数 | 行号 | 说明 |
|---|---|---|
| `_collect_tools(db)` | 51 | 加载 BotTools + Skills，返回 (openai_tools, tool_index) |
| `_execute_tool_call(tc, tool_index, db)` | 99 | 执行单个工具调用 |
| `_execute_skill(tool_def, arguments, db)` | 127 | 执行 Skill (prompt/script/hybrid) |
| `_build_tool_messages()` | 268 | 按 provider 格式化工具消息 |
| `_flatten_tool_messages(messages, provider)` | 278 | DeepSeek/Qwen 兼容：tool 消息转纯文本 |

---

### 4.3 System Prompt 构建

**文件** — `backend/app/services/system_prompt_service.py`

**`build_system_prompt()` (行 45-91)：**

组装顺序：
```
1. IDENTITY — "你是 MutiExpert 智能助手..."
2. PROVIDER_LABEL — 防止模型自称其他名字
3. GUIDELINES — 行为准则 (中文回复/引用来源/确认后再执行变更操作/用沙箱执行代码)
4. 动态能力 (从 DB 加载):
   ├─ 知识库列表 — _knowledge_summary(db)
   ├─ 启用工具及参数签名 — _tools_summary(db)
   ├─ 用户脚本 — _scripts_summary(db)
   ├─ 定时任务 — _tasks_summary(db)
   └─ 启用技能及描述 — _skills_summary(db)
```

---

### 4.4 RAG 知识检索

**文件** — `backend/app/services/rag_service.py`

```
用户消息
  │
  ▼
generate_embedding(query)          ← embedding_service.py
  │  调用 SiliconFlow Embedding API (OpenAI 兼容)
  ▼
search_similar_chunks(             ← vector_store.py
  db, query_embedding,
  knowledge_base_ids,
  top_k=5,
  threshold=0.3
)
  │  SQL: 1 - (dc.embedding <=> :embedding::vector)
  │  JOIN document_chunks + documents
  ▼
返回 (context_text, sources)
  │  格式: "[来源1] 文档标题 (0.85)\n内容片段..."
  ▼
build_rag_context(context, query)
  │  包装为 prompt 模板注入 system prompt
  ▼
yield PipelineEvent(type="sources", data={sources})
```

---

### 4.5 联网搜索 (Tavily)

**文件** — `backend/app/services/web_search_service.py`

```python
async def tavily_search(query: str, db) -> dict:
    # 调用 Tavily Search API
    # 返回搜索结果列表
    # 通过 build_search_context() 注入 system prompt
```

触发条件：用户在输入栏开启「搜索」模式 → modes 包含 `"search"`

---

### 4.6 工具系统 (BotTools + Skills)

#### BotTools — 平台内置工具

**定义加载** — `backend/app/services/intent/tools.py`
```python
load_tools(db)        # 从 DB 加载所有 enabled=True 的 BotTool
to_openai_tools(tools) # 转为 [{"type":"function","function":{...}}]
to_claude_tools(tools)  # 转为 [{"name":...,"input_schema":...}]
```

**自动同步** — `backend/app/api/bot_tools.py`
```
POST /api/v1/bot-tools/sync
  → 扫描 FastAPI 应用的 OpenAPI schema
  → 为每个 API 端点创建/更新 BotTool 记录
  → 提取 path/query/body 参数，生成 param_mapping
  → 新工具默认 enabled=False，用户手动启用
```

**执行** — `backend/app/services/intent/executor.py`
```python
async def execute_action(intent: IntentResult) -> dict:
    # 1. 构建 URL (替换路径参数)
    # 2. 映射工具参数到 query/body/path
    # 3. 发起内部 HTTP 请求 (GET/POST/PUT/DELETE)
    # 4. 返回 {"success": bool, "status_code": int, "data": ...}
```

#### Skills — 用户自定义技能

**执行** — `backend/app/services/skill_executor.py`

三种类型：
| 类型 | 执行方式 |
|---|---|
| `prompt` | 加载技能内容 + 引用 → 作为上下文喂给 AI |
| `script` | 执行关联的 UserScript |
| `hybrid` | 先执行脚本，再将输出喂给 AI 处理 |

触发方式：
1. AI 自动识别 → function calling 返回 `skill_{name}` 工具调用
2. 用户手动 → 消息以 `/skill_name` 开头

---

### 4.7 AI Provider 策略

**文件** — `backend/app/services/ai_service.py`

策略模式，三个策略类覆盖所有 provider：

| 策略类 | 适用 Provider | 流式 API | 生成 API (含工具调用) |
|---|---|---|---|
| `ClaudeStrategy` | claude | Anthropic SDK `messages.stream()` | Anthropic SDK `messages.create()` |
| `OpenAIResponsesStrategy` | openai | HTTP SSE → `/v1/responses` | HTTP SSE `/v1/responses` (stream=true, 收集) |
| `OpenAIChatCompletionsStrategy` | deepseek, qwen | HTTP SSE → `/chat/completions` | HTTP `/chat/completions` (stream=false) |

核心数据结构：
```python
@dataclass
class StreamChunk:
    type: str       # "text" | "thinking"
    content: str

@dataclass
class ToolCallResult:
    id: str
    name: str
    arguments: dict[str, Any]

@dataclass
class GenerateResult:
    text: str
    tool_calls: list[ToolCallResult]
    stop_reason: str
    usage: dict[str, int]
```

两个入口函数：
```python
# 流式输出 — 用于最终回复
async def stream_chat(messages, provider, system_prompt, db, model_name=None):
    # → yields StreamChunk(type="text"|"thinking", content=...)

# 非流式生成 — 用于工具循环中的 function calling
async def generate(messages, provider, system_prompt, tools, db, model_name=None):
    # → returns GenerateResult(text, tool_calls, stop_reason, usage)
```

Provider 配置优先级：
```
1. DB ai_model_configs 表 (可在管理页面修改)
2. 环境变量 (ANTHROPIC_API_KEY, OPENAI_API_KEY, ...)
3. 硬编码默认值
```

**配置管理** — `backend/app/services/ai_model_config.py`
- `get_provider_config(db, provider_id)` → `ProviderConfig` dataclass
- 支持字段：api_key, base_url, model, max_tokens, temperature, wire_api, reasoning_effort 等

兼容性处理：
- DeepSeek/Qwen: `_sanitize_messages()` 将 tool/function_call 消息转为纯文本
- OpenAI: `_fix_array_schemas()` 修补缺少 items 的 array schema (Responses API 严格校验)
- OpenAI o-series: 处理 reasoning summaries

---

### 4.8 Sandbox 沙箱

**API** — `backend/app/api/sandbox.py`
**服务** — `backend/app/services/sandbox_service.py`

提供 5 种沙箱能力，作为 BotTool 暴露给 AI：

| 工具 | 说明 | 安全措施 |
|---|---|---|
| `sandbox_shell` | 执行 Shell 命令 | 命令黑名单 |
| `sandbox_python` | 执行 Python 代码 | 临时文件隔离 |
| `sandbox_read_file` | 读取文件 | 路径遍历防护，限制在 `/app/workspace` |
| `sandbox_write_file` | 写入文件 | 同上 |
| `sandbox_fetch_url` | 抓取网页 | HTML 标签剥离 |

所有操作限制在 `/app/workspace` 目录内。

---

## 5. SSE 事件协议

前后端通过 SSE (Server-Sent Events) 通信，事件格式：

```
event: {type}\ndata: {json}\n\n
```

完整事件类型：

| 事件类型 | 数据结构 | 触发时机 | 前端处理 |
|---|---|---|---|
| `chunk` | `{"content": "文本片段"}` | AI 生成文本增量 | `appendChunk()` → 累积显示 |
| `thinking` | `{"content": "推理片段"}` | AI 推理过程增量 (DeepSeek-R1 等) | `appendThinking()` → ThinkingBlock |
| `sources` | `{"sources": [{document_name, content_preview, relevance_score, document_id}]}` | RAG 检索完成 | `setSources()` → SourceReferences |
| `tool_start` | `{"name": "工具名", "args": {...}}` | 工具开始执行 | `addToolStart()` → ToolCallBlock (spinner) |
| `tool_result` | `{"name": "工具名", "result": "...", "success": bool}` | 工具执行完成 | `updateToolResult()` → ToolCallBlock (✓/✗) |
| `web_search` | `{"results": [{title, url, content}]}` | Tavily 搜索完成 | `setWebSearchResults()` |
| `done` | `{"message_id": "uuid", "latency_ms": 1234, "tokens_used": 500, "prompt_tokens": 300, "completion_tokens": 200, "cost_usd": 0.01}` | 流式传输完成 | `markDone()` → 保存状态，停止 spinner |
| `error` | `{"error": "错误信息"}` | 任何环节出错 | `markError()` → 显示错误提示 |

---

## 6. System Prompt 详解

### 6.1 组装逻辑

**文件** — `backend/app/services/system_prompt_service.py`

System Prompt 是纯代码驱动的，没有数据库存储的可编辑模板，也没有前端编辑器。每次 AI 调用时实时组装：

```
build_system_prompt(db)
  │
  ├─ 1. IDENTITY (静态) — "你是 MutiExpert 智能助手..."
  ├─ 2. PROVIDER_LABEL — "当前底层模型：Claude" (防止模型自称其他名字)
  ├─ 3. GUIDELINES (静态) — 行为准则
  └─ 4. 动态能力清单 (从 DB 实时查询)
       ├─ _knowledge_summary() — 知识库列表
       ├─ _tools_summary() — 启用的 BotTools + 参数签名
       ├─ _scripts_summary() — 用户脚本列表
       ├─ _tasks_summary() — 定时任务列表
       └─ _skills_summary() — 启用的技能 + 描述
```

### 6.2 静态常量

```python
# IDENTITY (行 17)
"你是 MutiExpert 智能助手，一个多行业知识管理平台的 AI 核心..."

# PROVIDER_LABELS (行 21)
{"claude": "Claude", "openai": "OpenAI GPT", "deepseek": "DeepSeek", "qwen": "通义千问"}

# GUIDELINES (行 28) — 核心行为准则:
# - 使用中文回复
# - 引用知识库时标注 [来源1] [来源2]
# - 执行变更操作前先确认
# - 代码执行使用沙箱工具
# - 触发技能使用 /技能名 格式
```

### 6.3 动态能力加载

`_load_capabilities()` (行 94) 从 DB 查询 5 个模块，生成 Markdown 格式的能力描述：

| 函数 | 行号 | 查询内容 | 输出示例 |
|---|---|---|---|
| `_knowledge_summary()` | 134 | 最多 20 个知识库 | `### 知识库\n- 法律知识库（法律行业）` |
| `_tools_summary()` | 149 | 所有 enabled BotTools | `### 可用工具\n- create_todo(title, content): 创建待办` |
| `_scripts_summary()` | 168 | 最多 20 个 UserScripts | `### 用户脚本\n- 数据清洗脚本` |
| `_tasks_summary()` | 183 | 所有活跃定时任务 | `### 定时任务\n- 日报生成 (0 9 * * *)` |
| `_skills_summary()` | 207 | 所有 enabled Skills | `### 技能\n- 翻译助手: 多语言翻译` |

这意味着 AI 在每次对话中都能"看到"平台当前有哪些知识库、工具、脚本、任务和技能可用。

### 6.4 运行时增强

`build_system_prompt()` 返回基础 prompt 后，`pipeline_service.run_stream()` 还会追加：

```
基础 System Prompt (build_system_prompt)
  │
  ├─ + RAG 上下文 (如果 modes 含 "knowledge")
  │     build_rag_context(检索结果, 用户问题)
  │
  ├─ + 对话记忆摘要 (如果 conversation.memory_enabled)
  │     "以下是之前对话的摘要：..."
  │
  └─ + 联网搜索结果 (如果 modes 含 "search")
        build_search_context(Tavily 搜索结果)
```

### 6.5 管理方式

| 方面 | 现状 |
|---|---|
| 存储位置 | 代码硬编码 (`system_prompt_service.py`) |
| 前端编辑器 | **无** — 不存在 System Prompt 编辑页面 |
| API 端点 | **无** — 没有读取/修改 System Prompt 的接口 |
| 修改方式 | 直接编辑 `system_prompt_service.py` 源码 |
| 动态部分 | 通过 DB 数据自动生成 (知识库/工具/技能等的增删会自动反映) |
| compact 模式 | 定时任务和意图识别使用精简版 (省略脚本和任务列表) |

调用点：
| 调用者 | 文件 | 模式 |
|---|---|---|
| `pipeline_service.run_stream()` | pipeline_service.py:320 | 完整模式 |
| `scheduler_service._execute_task()` | scheduler_service.py:60 | compact 模式 |
| `intent/router.recognize_intent()` | intent/router.py:46 | compact 模式 |

---

## 7. Skills 技能系统详解

本项目存在两套技能系统：DB 驱动的主系统（用于聊天）和文件式的 legacy 系统（仅用于定时任务）。

### 7.1 数据模型

**文件** — `backend/app/models/extras.py`

三张表构成技能数据模型：

```
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│     skills       │     │  skill_references    │     │  skill_scripts   │
├──────────────────┤     ├──────────────────────┤     ├──────────────────┤
│ id (UUID, PK)    │◄──┐ │ id (UUID, PK)        │     │ id (UUID, PK)    │
│ name             │   │ │ skill_id (FK)────────┼──►  │ skill_id (FK)────┼──►skills
│ description      │   │ │ name                 │     │ script_id (FK)───┼──►user_scripts
│ skill_type       │   │ │ ref_type             │     │ sort_order       │
│ content          │   │ │ content              │     └──────────────────┘
│ icon             │   │ │ file_path            │
│ sort_order       │   │ │ sort_order           │
│ config (JSONB)   │   │ └──────────────────────┘
│ enabled          │   │
└──────────────────┘   └─ CASCADE 删除
```

**Skill 字段说明：**
| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | String(200) | 技能名称，也用于生成工具名 `skill_{name}` |
| `description` | Text | AI 用来判断何时调用此技能的描述 |
| `skill_type` | String(20) | `"prompt"` / `"script"` / `"hybrid"` |
| `content` | Text | TiptapEditor 富文本内容 (prompt 模板) |
| `enabled` | Boolean | 是否启用，默认 True |

**SkillReference 字段说明：**
| 字段 | 类型 | 说明 |
|---|---|---|
| `ref_type` | String(20) | `"markdown"` / `"pdf"` / `"image"` / `"url"` |
| `content` | Text | Markdown 内容或 URL |
| `file_path` | Text | 上传文件路径 |

**SkillScript** — 多对多关联表，将 Skill 链接到 UserScript。

### 7.2 后端 CRUD API

**文件** — `backend/app/api/skills.py`
**路由前缀** — `/api/v1/skills`

**技能管理：**
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 列出所有技能 (含 ref_count, script_count) |
| POST | `/` | 创建技能 |
| GET | `/{id}` | 获取技能详情 (含 references + script links) |
| PUT | `/{id}` | 更新技能 |
| DELETE | `/{id}` | 删除技能 (CASCADE 删除引用和脚本链接) |
| POST | `/{id}/toggle` | 切换启用/禁用 |
| POST | `/bulk-enable` | 批量启用/禁用 |

**引用管理：**
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/{id}/references` | 列出技能的所有引用 |
| POST | `/{id}/references` | 添加引用 (markdown/url/pdf/image) |
| PUT | `/{id}/references/{ref_id}` | 更新引用 |
| DELETE | `/{id}/references/{ref_id}` | 删除引用 |

**脚本链接管理：**
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/{id}/scripts` | 列出关联的脚本 |
| POST | `/{id}/scripts` | 链接一个 UserScript |
| DELETE | `/{id}/scripts/{link_id}` | 取消链接 |

### 7.3 前端管理页面

**文件** — `frontend/src/pages/skills/SkillsPage.tsx`
**路由** — `/skills`
**服务** — `frontend/src/services/skillsService.ts`

页面功能：
```
┌─────────────────────────────────────────────────┐
│  统计卡片: 总数 | 已启用 | prompt 类型 | script 类型  │
├─────────────────────────────────────────────────┤
│  数据表格                                        │
│  ┌─────────┬──────┬──────┬──────┬──────┐       │
│  │名称+图标 │ 类型  │引用数│脚本数│状态   │       │
│  │+描述     │badge │      │      │toggle │       │
│  ├─────────┼──────┼──────┼──────┼──────┤       │
│  │翻译助手  │prompt│  3   │  0   │ ✓    │       │
│  │数据分析  │hybrid│  1   │  2   │ ✓    │       │
│  └─────────┴──────┴──────┴──────┴──────┘       │
│  行操作: [详情] [编辑] [删除]                     │
├─────────────────────────────────────────────────┤
│  创建/编辑对话框:                                 │
│  - 名称、类型选择 (prompt/script/hybrid)          │
│  - 描述、图标选择                                 │
│  - TiptapEditor 富文本编辑器 (content)            │
├─────────────────────────────────────────────────┤
│  详情面板:                                       │
│  - 技能信息                                      │
│  - 引用列表 (添加/删除 markdown/url/pdf/image)    │
│  - 脚本链接 (链接/取消链接 UserScript)             │
└─────────────────────────────────────────────────┘
```

### 7.4 技能如何变成 AI 可调用工具

**关键函数** — `pipeline_service.py:_collect_tools()` (行 51-96)

```
_collect_tools(db)
  │
  ├─ Step 1: 加载 BotTools
  │   load_tools(db) → to_openai_tools()
  │   → [{"type":"function","function":{"name":"create_todo",...}}]
  │
  └─ Step 2: 加载 Skills (行 69-96)
      查询: SELECT * FROM skills WHERE enabled=True AND description IS NOT NULL
      │
      对每个 Skill 生成一个 function tool:
      │
      ├─ 工具名: skill_{name.replace(' ','_').lower()}
      │   例: "翻译助手" → "skill_翻译助手"
      │
      ├─ 工具定义:
      │   {
      │     "type": "function",
      │     "function": {
      │       "name": "skill_翻译助手",
      │       "description": "多语言翻译，支持中英日韩...",  ← 来自 skill.description
      │       "parameters": {
      │         "type": "object",
      │         "properties": {
      │           "query": {"type":"string","description":"用户的具体需求"}
      │         },
      │         "required": ["query"]
      │       }
      │     }
      │   }
      │
      └─ 注册到 tool_index:
          tool_index["skill_翻译助手"] = {
            "source": "skill",
            "skill_id": uuid,
            "skill_type": "prompt"
          }
```

AI 根据 `description` 字段自主决定是否调用某个技能 — 这是唯一的路由机制。

### 7.5 技能执行流程

**关键函数** — `pipeline_service.py:_execute_skill()` (行 127-209)

```
AI 返回 tool_call: skill_翻译助手(query="把这段话翻译成英文")
  │
  ▼
_execute_tool_call() 检测 source == "skill"
  │
  ▼
_execute_skill(tool_def, arguments, db)
  │
  ├─ 1. 从 DB 加载 Skill 记录
  ├─ 2. 加载所有 SkillReferences → 拼接为 ref_context
  │
  └─ 3. 按 skill_type 分支执行:
       │
       ├─ "prompt" 类型:
       │   构建 prompt = skill.content + ref_context + user query
       │   → stream_chat() 调用 AI 生成回复
       │   → 返回生成的文本
       │
       ├─ "script" 类型:
       │   加载关联的 SkillScripts → UserScripts
       │   → execute_script() 执行每个脚本 (30s 超时)
       │   → 返回脚本输出的拼接结果
       │
       └─ "hybrid" 类型:
           先执行脚本 (同 script 类型)
           构建 prompt = skill.content + ref_context + 脚本输出 + user query
           → stream_chat() 调用 AI 处理
           → 返回 AI 生成的文本
```

用户也可以手动触发技能：消息以 `/技能名` 开头 → `chat.py:send_message()` (行 159-168) 检测并改写消息。

### 7.6 文件式技能 (legacy)

**文件** — `backend/app/services/skill_executor.py`

独立于 DB 技能系统的旧方案，基于磁盘文件：

```
skills/
├── registry.yaml          ← 技能注册表
├── yaml/
│   ├── summarizer.yaml    ← YAML 技能 (prompt 模板)
│   ├── translator.yaml
│   ├── data_analyzer.yaml
│   ├── cross_industry_linker.yaml
│   ├── report_generator.yaml
│   └── qa_enhancer.yaml
└── python/                ← Python 技能 (可执行模块)
```

YAML 技能示例 (`summarizer.yaml`):
```yaml
name: summarizer
description: 对知识库文档进行智能摘要
prompt: |
  请对以下内容进行结构化摘要...
  {content}
tools:
  - rag
output: markdown
```

执行方式：
- `load_registry()` → 读取 `registry.yaml`
- `execute_yaml_skill()` → 填充 `{content}` 和 `{param}` 占位符 → 发送给 AI
- `execute_python_skill()` → 动态导入 Python 模块 → 调用 `module.execute()`

**仅在定时任务中使用** (`scheduler_service.py`，`task_type == "skill_exec"`)，不参与聊天流程。

### 7.7 两套技能系统对比

| 维度 | DB 技能 (主系统) | 文件式技能 (legacy) |
|---|---|---|
| 存储 | PostgreSQL (skills 表) | 磁盘文件 (skills/ 目录) |
| 管理 | 前端 SkillsPage CRUD | 手动编辑 YAML/Python 文件 |
| 触发方式 | AI function calling / `/技能名` 命令 | 仅定时任务 `skill_exec` |
| 参与聊天 | ✓ 作为 tool 暴露给 AI | ✗ 不参与 |
| 支持类型 | prompt / script / hybrid | yaml / python |
| 引用系统 | SkillReference (markdown/url/pdf/image) | 无 |
| 脚本关联 | SkillScript → UserScript | 无 |
| 代码位置 | `pipeline_service.py:_execute_skill()` | `skill_executor.py` |

---

## 8. 关键文件索引

### 前端

| 文件 | 说明 |
|---|---|
| `frontend/src/pages/assistant/AIAssistantPage.tsx` | 助手入口页：新对话输入 + 会话侧边栏 |
| `frontend/src/pages/assistant/AIAssistantChatPage.tsx` | 聊天主页面：消息展示 + 流式渲染 + 输入栏 |
| `frontend/src/services/api.ts` | Axios 基础客户端 (baseURL: `/api/v1`) |
| `frontend/src/services/chatService.ts` | 会话 CRUD + SSE 流式通信函数 |
| `frontend/src/lib/streamRegistry.ts` | 模块级流式状态管理 (独立于 React 生命周期) |
| `frontend/src/stores/useAppStore.ts` | Zustand 全局状态 (模型选择/主题/侧边栏) |
| `frontend/src/types/index.ts` | TypeScript 类型定义 (ModelProvider, Conversation, Message 等) |
| `frontend/src/components/composed/thinking-block.tsx` | 折叠式推理过程展示组件 |
| `frontend/src/services/skillsService.ts` | Skills CRUD 服务 |
| `frontend/src/services/botToolService.ts` | BotTools 管理服务 |
| `frontend/src/services/knowledgeBaseService.ts` | 知识库管理服务 |
| `frontend/src/pages/skills/SkillsPage.tsx` | 技能管理页面 (CRUD + 引用 + 脚本链接) |

### 后端 — API 层

| 文件 | 说明 |
|---|---|
| `backend/app/api/router.py` | 路由注册总入口 |
| `backend/app/api/chat.py` | 会话/消息端点 + SSE StreamingResponse |
| `backend/app/api/bot_tools.py` | BotTools 管理 + OpenAPI 自动同步 |
| `backend/app/api/sandbox.py` | 沙箱 HTTP 端点 |
| `backend/app/api/skills.py` | Skills CRUD + 引用 + 脚本链接端点 |
| `backend/app/api/system.py` | 健康检查 + AI 模型配置 + Tavily 配置 |
| `backend/app/schemas/chat.py` | Pydantic 请求/响应模型 |

### 后端 — 服务层

| 文件 | 说明 |
|---|---|
| `backend/app/services/pipeline_service.py` | **核心编排器**: RAG + 工具 + 搜索 + 流式输出 |
| `backend/app/services/ai_service.py` | 多 Provider AI 抽象 (策略模式) |
| `backend/app/services/ai_model_config.py` | Provider 配置管理 + 默认值 |
| `backend/app/services/system_prompt_service.py` | 动态 System Prompt 构建 |
| `backend/app/services/rag_service.py` | RAG 检索 (embedding + 向量搜索) |
| `backend/app/services/embedding_service.py` | SiliconFlow Embedding API 调用 |
| `backend/app/services/vector_store.py` | pgvector 余弦相似度搜索 |
| `backend/app/services/web_search_service.py` | Tavily 联网搜索 |
| `backend/app/services/intent/tools.py` | BotTools 加载 + 格式转换 |
| `backend/app/services/intent/executor.py` | BotTool 执行 (内部 HTTP 调用) |
| `backend/app/services/intent/router.py` | 意图识别路由 (legacy) |
| `backend/app/services/skill_executor.py` | 文件式 Skill 执行 (legacy, 仅定时任务) |
| `backend/app/services/sandbox_service.py` | 沙箱服务 (Shell/Python/文件/网页) |
| `backend/app/services/scheduler_service.py` | 定时任务调度 (调用 file-based skills) |

### 后端 — 数据模型

| 文件 | 说明 |
|---|---|
| `backend/app/models/extras.py` | SQLAlchemy 模型 (Conversation, Message, Skill, BotTool 等) |

---

> 文档生成时间: 2026-02-22
> 基于代码库当前状态自动梳理
