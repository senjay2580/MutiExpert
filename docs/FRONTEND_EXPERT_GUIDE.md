# MutiExpert 前端专家参考文档

> 供 AI 在后续开发中快速理解项目技术栈、组件体系、设计规范的完整参考手册。
> 生成日期: 2026-02-20

---

## 目录

1. [技术栈总览](#1-技术栈总览)
2. [依赖清单与版本](#2-依赖清单与版本)
3. [项目结构](#3-项目结构)
4. [构建与开发配置](#4-构建与开发配置)
5. [路由体系](#5-路由体系)
6. [组件架构](#6-组件架构)
7. [图标体系](#7-图标体系)
8. [插图资源](#8-插图资源)
9. [主题与样式体系](#9-主题与样式体系)
10. [状态管理](#10-状态管理)
11. [API 服务层](#11-api-服务层)
12. [动画体系](#12-动画体系)
13. [TypeScript 类型定义](#13-typescript-类型定义)
14. [设计模式与开发约定](#14-设计模式与开发约定)
15. [设计哲学与审美体系](#15-设计哲学与审美体系)
16. [高级样式技法](#16-高级样式技法)
17. [Claude Code Skills 编排体系](#17-claude-code-skills-编排体系)
18. [链接引用](#18-链接引用)

---

## 1. 技术栈总览

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | React | 19.2 | UI 构建 |
| **语言** | TypeScript | 5.9 | 类型安全 |
| **构建** | Vite | 7.3 | 开发服务器 + 打包 |
| **样式** | Tailwind CSS | 4.2 | 原子化 CSS |
| **组件库** | shadcn/ui (new-york) | — | 基础 UI 原子组件 |
| **图标** | @iconify/react | 6.0 | 统一图标方案 (Lucide + Streamline) |
| **状态** | Zustand | 5.0 | 全局状态管理 |
| **路由** | React Router | 7.13 | SPA 路由 |
| **数据获取** | TanStack Query | 5.90 | 服务端状态管理 |
| **HTTP** | Axios | 1.13 | API 请求 |
| **动画** | Motion (Framer) | 12.34 | 微交互动画 |
| **编辑器** | Tiptap | 3.20 | 富文本编辑 |
| **图谱** | Cytoscape.js | 3.33 | 知识图谱可视化 |
| **图表** | Recharts | 3.7 | 数据图表 |
| **Markdown** | react-markdown | 10.1 | AI 回复渲染 |
| **Toast** | Sonner | 2.0 | 通知提示 |

---

## 2. 依赖清单与版本

### 生产依赖

```json
{
  "@iconify/react": "^6.0.2",          // 图标渲染（Lucide + Streamline Color）
  "@radix-ui/react-slot": "^1.2.4",    // shadcn/ui 底层 Slot 组件
  "@tailwindcss/vite": "^4.2.0",       // Tailwind Vite 插件
  "@tanstack/react-query": "^5.90.21", // 服务端状态 & 缓存
  "@tiptap/extension-heading": "^3.20.0",
  "@tiptap/extension-link": "^3.20.0",
  "@tiptap/extension-placeholder": "^3.20.0",
  "@tiptap/pm": "^3.20.0",
  "@tiptap/react": "^3.20.0",
  "@tiptap/starter-kit": "^3.20.0",    // 富文本编辑器全家桶
  "axios": "^1.13.5",                  // HTTP 客户端
  "class-variance-authority": "^0.7.1", // CVA — 组件变体系统
  "clsx": "^2.1.1",                    // 条件 className 合并
  "cmdk": "^1.1.1",                    // Command Palette 底层
  "cytoscape": "^3.33.1",             // 知识图谱可视化引擎
  "motion": "^12.34.2",               // Framer Motion 动画
  "next-themes": "^0.4.6",            // 主题切换（未直接使用，shadcn 依赖）
  "radix-ui": "^1.4.3",               // Radix UI 无样式原语
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-markdown": "^10.1.0",        // Markdown 渲染
  "react-router-dom": "^7.13.0",      // SPA 路由
  "recharts": "^3.7.0",               // 图表库
  "rehype-highlight": "^7.0.2",       // 代码高亮
  "sonner": "^2.0.7",                 // Toast 通知
  "tailwind-merge": "^3.5.0",         // Tailwind 类名冲突合并
  "tailwindcss": "^4.2.0",
  "zustand": "^5.0.11"                // 状态管理
}
```

### 开发依赖

```json
{
  "@vitejs/plugin-react": "^5.1.1",   // Vite React 插件
  "shadcn": "^3.8.5",                 // shadcn CLI（添加组件用）
  "tw-animate-css": "^1.4.0",         // Tailwind 动画扩展
  "typescript": "~5.9.3",
  "vite": "^7.3.1"
}
```

---

## 3. 项目结构

```
frontend/
├── public/
│   ├── logo.svg                       # 应用 Logo
│   └── illustrations/storyset/        # Storyset 矢量插图 (13个)
├── src/
│   ├── components/
│   │   ├── ui/                        # shadcn/ui 基础组件 (25个)
│   │   ├── composed/                  # 业务组合组件 (14个)
│   │   ├── dashboard/                 # Dashboard 专用组件
│   │   └── editor/                    # 编辑器组件
│   ├── layouts/                       # 布局组件 (4个)
│   ├── pages/                         # 页面组件 (7个)
│   ├── stores/                        # Zustand 状态 (2个)
│   ├── hooks/                         # 自定义 Hooks (2个)
│   ├── services/                      # API 服务层 (7个)
│   ├── lib/                           # 工具函数 (3个)
│   ├── types/                         # TS 类型定义
│   ├── routes/                        # 路由配置
│   ├── App.tsx                        # 应用入口
│   └── index.css                      # 全局样式 + 主题变量
├── components.json                    # shadcn/ui 配置
├── vite.config.ts
├── tsconfig.app.json
└── package.json
```

---

## 4. 构建与开发配置

### Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
});
```

**关键点:**
- `@/` 路径别名 → `./src/`
- 开发代理: `/api` → `localhost:8000` (FastAPI 后端)
- 构建命令: `tsc -b && vite build` (先类型检查再打包)

### TypeScript 配置

- `target`: ES2022
- `strict`: true
- `noUnusedLocals` + `noUnusedParameters`: 强制无死代码
- `verbatimModuleSyntax`: 强制显式 `type` 导入

### shadcn/ui 配置

```json
{
  "style": "new-york",     // New York 风格（更紧凑）
  "rsc": false,            // 非 RSC（纯 CSR）
  "tailwind": {
    "baseColor": "neutral", // 中性灰基色
    "cssVariables": true    // 使用 CSS 变量
  },
  "iconLibrary": "lucide"  // 图标库
}
```

---

## 5. 路由体系

```
/                              → Redirect → /dashboard
├── /dashboard                 → DashboardPage (总览)
├── /knowledge                 → KnowledgePage (知识库列表)
├── /knowledge/:industryId     → KnowledgeDetailPage (知识库详情 + AI 问答)
├── /scheduler                 → ScheduledTasksPage (定时任务)
└── /settings                  → SettingsLayout (设置)
    ├── /settings/ai-models    → AIModelsPage (AI 模型配置)
    ├── /settings/integrations → IntegrationsPage (集成管理)
    └── /settings/data         → DataManagementPage (数据管理)
```

**布局嵌套:**
```
AppLayout (Sidebar + Header + CommandPalette)
  └── Outlet
      ├── 普通页面直接渲染
      └── SettingsLayout (Tab 导航)
          └── Outlet → 设置子页面
```

---

## 6. 组件架构

### 6.1 shadcn/ui 基础组件 (25个)

| 组件 | 文件 | 基于 |
|------|------|------|
| Avatar | `ui/avatar.tsx` | Radix Avatar |
| Badge | `ui/badge.tsx` | CVA variants |
| Button | `ui/button.tsx` | Radix Slot + CVA |
| Card | `ui/card.tsx` | 原生 div |
| Collapsible | `ui/collapsible.tsx` | Radix Collapsible |
| Command | `ui/command.tsx` | cmdk |
| ContextMenu | `ui/context-menu.tsx` | Radix ContextMenu |
| Dialog | `ui/dialog.tsx` | Radix Dialog |
| DropdownMenu | `ui/dropdown-menu.tsx` | Radix DropdownMenu |
| Input | `ui/input.tsx` | 原生 input |
| Progress | `ui/progress.tsx` | Radix Progress |
| ScrollArea | `ui/scroll-area.tsx` | Radix ScrollArea |
| Select | `ui/select.tsx` | Radix Select |
| Separator | `ui/separator.tsx` | Radix Separator |
| Sheet | `ui/sheet.tsx` | Radix Dialog |
| Sidebar | `ui/sidebar.tsx` | 自定义 (含 Provider) |
| Skeleton | `ui/skeleton.tsx` | 原生 div |
| Switch | `ui/switch.tsx` | Radix Switch |
| Table | `ui/table.tsx` | 原生 table |
| Tabs | `ui/tabs.tsx` | Radix Tabs |
| Textarea | `ui/textarea.tsx` | 原生 textarea |
| Tooltip | `ui/tooltip.tsx` | Radix Tooltip |
| Sonner | `ui/sonner.tsx` | sonner 封装 |
| ThemeToggle | `ui/ThemeToggle.tsx` | 自定义 |
| DayNightToggle | `ui/DayNightToggle.tsx` | 自定义动画切换 |

### 6.2 业务组合组件 (14个)

| 组件 | 导出 | 用途 | Props |
|------|------|------|-------|
| **AnimatedList/Item** | `animated.tsx` | 列表/卡片入场动画 | `className`, `delay` |
| **ChatPanel** | `chat-panel.tsx` | AI 问答面板 (SSE 流式) | `knowledgeBaseId`, `onClose?` |
| **CommandPalette** | `command-palette.tsx` | 全局命令面板 (⌘K) | — (读 Zustand store) |
| **ConfirmDialog** | `confirm-dialog.tsx` | 确认弹窗 | `open`, `title`, `description`, `variant`, `onConfirm`, `loading` |
| **DataTable** | `data-table.tsx` | 通用数据表格 | `columns`, `data`, `searchKey?` |
| **EmptyState** | `empty-state.tsx` | 空状态占位 | `icon`, `illustration?`, `title`, `description`, `action?` |
| **IndustryBadge** | `industry-badge.tsx` | 行业标签 | `industry` |
| **ItemContextMenu** | `item-context-menu.tsx` | 右键菜单封装 | `actions[]`, `children` |
| **LoadingSkeleton** | `loading-skeleton.tsx` | 骨架屏预设 | `count` |
| **MessageBubble** | `message-bubble.tsx` | 聊天消息气泡 | `message`, `sources?` |
| **PageHeader** | `page-header.tsx` | 页面标题栏 | `icon`, `title`, `description`, `actions` |
| **SearchBar** | `search-bar.tsx` | 防抖搜索 (300ms) | `value`, `onChange`, `placeholder` |
| **SolidButton** | `solid-button.tsx` | 彩色按钮 (含图标底色) | `color`, `icon`, `loading`, `loadingText` |
| **StatCard** | `stat-card.tsx` | Dashboard 指标卡 | `label`, `value`, `icon`, `trend?` |

### 6.3 布局组件

| 布局 | 职责 |
|------|------|
| **AppLayout** | 根布局: SidebarProvider → Sidebar + Header + Outlet + CommandPalette |
| **Header** | 顶部栏: 面包屑 (自动生成) + 主题切换 |
| **Sidebar** | 侧边导航: 可折叠分组 + Logo + 设置入口 |
| **SettingsLayout** | 设置子布局: Tab 导航 + Outlet |

### 6.4 特殊组件

| 组件 | 位置 | 技术 |
|------|------|------|
| **TiptapEditor** | `editor/TiptapEditor.tsx` | Tiptap StarterKit + Link + Heading + Placeholder |
| **KnowledgeGraphView** | `dashboard/KnowledgeGraphView.tsx` | Cytoscape.js, 响应式节点大小, 暗色模式 |

---

## 7. 图标体系

### 方案: @iconify/react 统一管理

项目通过 `@iconify/react` 的 `<Icon>` 组件渲染所有图标，支持 200+ 图标集按需加载。

**使用方式:**
```tsx
import { Icon } from '@iconify/react';

<Icon icon="lucide:sparkles" width={16} height={16} className="text-primary" />
<Icon icon="streamline-color:open-book" width={20} height={20} />
```

### 7.1 Lucide 图标集 (`lucide:` 前缀) — 26个

> 线性风格，用于 UI 交互元素

| 图标 | 语义 | 使用场景 |
|------|------|----------|
| `lucide:sparkles` | AI/智能 | ChatPanel 标识、AI 功能 |
| `lucide:plus` | 新增 | 新建对话、新建知识库 |
| `lucide:search` | 搜索 | Command Palette 搜索框 |
| `lucide:search-x` | 无结果 | 空搜索结果 |
| `lucide:arrow-left` | 返回 | 导航返回 |
| `lucide:arrow-up` | 发送 | 聊天发送按钮 |
| `lucide:arrow-up-right` | 外部链接 | Dashboard 跳转 |
| `lucide:chevron-down` | 展开 | 折叠面板、下拉 |
| `lucide:chevron-left` | 左箭头 | 分页、折叠 |
| `lucide:chevron-right` | 右箭头 | 面包屑分隔、展开 |
| `lucide:chevrons-left` | 首页 | 表格分页 |
| `lucide:chevrons-right` | 末页 | 表格分页 |
| `lucide:chevrons-up-down` | 排序 | 表格列排序 |
| `lucide:ellipsis-vertical` | 更多操作 | 菜单触发器 |
| `lucide:file-text` | 文档 | 引用来源、文档计数 |
| `lucide:puzzle` | 模块/块 | 知识块计数 |
| `lucide:loader` | 加载中 | 处理中状态 |
| `lucide:loader-2` | 旋转加载 | 发送中动画 |
| `lucide:check-circle` | 完成 | 就绪状态 |
| `lucide:alert-circle` | 警告 | 错误状态 |
| `lucide:x` | 关闭 | 关闭表单/面板 |
| `lucide:layout-grid` | 网格视图 | 视图切换 |
| `lucide:list` | 列表视图 | 视图切换 |
| `lucide:pencil` | 编辑 | 编辑操作 |
| `lucide:trash-2` | 删除 | 删除操作 |
| `lucide:external-link` | 外链 | 打开外部链接 |
| `lucide:panel-right-close` | 收起面板 | AI 面板折叠 |
| `lucide:settings-2` | 设置 | 表格列设置 |

### 7.2 Streamline Color 图标集 (`streamline-color:` 前缀) — 53个

> 彩色填充风格，用于功能标识和装饰

#### 导航 & 侧边栏

| 图标 | 语义 |
|------|------|
| `streamline-color:dashboard-3` | Dashboard 菜单 |
| `streamline-color:open-book` | 知识库菜单 |
| `streamline-color:circle-clock` | 定时任务菜单 |
| `streamline-color:cog` | 设置菜单 |
| `streamline-color:computer-chip-1` | AI 模型设置 |
| `streamline-color:electric-cord-1` | 集成设置 |
| `streamline-color:database` | 数据管理设置 |
| `streamline-color:insert-side` | Sidebar 折叠 |

#### 文档 & 文件类型

| 图标 | 语义 |
|------|------|
| `streamline-color:new-file` | 文件文档 (PDF/DOCX/MD) |
| `streamline-color:earth-1` | 链接类型文档 |
| `streamline-color:pen-draw` | 文章类型文档 |
| `streamline-color:upload-box-1` | 上传 |
| `streamline-color:download-box-1` | 下载 |
| `streamline-color:link-chain` | 添加链接 |
| `streamline-color:share-link` | 分享链接 |

#### 操作按钮

| 图标 | 语义 |
|------|------|
| `streamline-color:delete-1` | 关闭/删除 (Dialog/Sheet) |
| `streamline-color:recycle-bin-2` | 删除按钮 |
| `streamline-color:pencil` | 编辑按钮 |
| `streamline-color:add-1` | 添加按钮 |
| `streamline-color:floppy-disk` | 保存按钮 |
| `streamline-color:button-play` | 运行/播放 |
| `streamline-color:magnifying-glass` | 搜索/预览 |
| `streamline-color:signal-loading` | 加载中 |
| `streamline-color:arrow-reload-horizontal-1` | 刷新 |

#### 编辑器工具栏

| 图标 | 语义 |
|------|------|
| `streamline-color:text-style` | 文字样式 |
| `streamline-color:paragraph` | 段落 |
| `streamline-color:heading-2-paragraph-styles-heading` | 标题 |
| `streamline-color:bullet-list` | 无序列表 |
| `streamline-color:ascending-number-order` | 有序列表 |
| `streamline-color:curly-brackets` | 代码块 |
| `streamline-color:return-2` | 换行 |
| `streamline-color:ai-redo-spark` | AI 辅助 |

#### 数据 & 图表

| 图标 | 语义 |
|------|------|
| `streamline-color:graph-arrow-increase` | 上升趋势 |
| `streamline-color:graph-arrow-decrease` | 下降趋势 |
| `streamline-color:subtract-1` | 持平趋势 |
| `streamline-color:module-puzzle-3` | 知识图谱/模块 |
| `streamline-color:hierarchy-2` | 层级/关系 |
| `streamline-color:local-storage-folder` | 存储 |

#### 通知 & 反馈

| 图标 | 语义 |
|------|------|
| `streamline-color:check` | 成功 ✓ |
| `streamline-color:circle` | 圆点指示器 |
| `streamline-color:information-circle` | 信息提示 |
| `streamline-color:warning-triangle` | 警告提示 |
| `streamline-color:warning-octagon` | 错误提示 |

#### 主题 & 杂项

| 图标 | 语义 |
|------|------|
| `streamline-color:brightness-1` | 亮色主题 |
| `streamline-color:waning-cresent-moon` | 暗色主题 |
| `streamline-color:move-right` | 子菜单箭头 |
| `streamline-color:arrow-down-2` | 下拉箭头 |
| `streamline-color:arrow-up-1` | 上拉箭头 |
| `streamline-color:artificial-intelligence-spark` | AI 模型 |
| `streamline-color:user-circle-single` | 用户头像 |
| `streamline-color:invisible-1` | 隐藏 (密钥) |
| `streamline-color:visible` | 显示 (密钥) |
| `streamline-color:test-tube` | 测试 |
| `streamline-color:chat-bubble-text-square` | 对话 |
| `streamline-color:lightbulb` | 洞察/提示 |

### 7.3 图标使用规范

```
┌─────────────────────────────────────────┐
│ 选择图标的决策树                          │
│                                         │
│ 需要图标 → 是交互控件？                    │
│              ├── 是 → lucide: (线性)      │
│              └── 否 → 是功能标识/装饰？     │
│                       ├── 是 → streamline-color: (彩色) │
│                       └── 否 → lucide: (默认) │
└─────────────────────────────────────────┘
```

**命名约定:**
- Iconify 格式: `{图标集}:{图标名}` (如 `lucide:sparkles`, `streamline-color:open-book`)
- 尺寸: 通常 `width={14-20}` 配合 `height={同值}`
- 颜色: 通过 Tailwind `className` 控制 (如 `text-primary`, `text-muted-foreground`)

---

## 8. 插图资源

### 来源: Storyset by Freepik

- **风格**: Pana (扁平 + 手绘元素)
- **许可**: 免费用于个人和商业项目 (需署名)
- **文档**: https://storyset.com/
- **位置**: `/public/illustrations/storyset/`

### 插图文件清单

| 文件名 | 关键词匹配 | 使用场景 |
|--------|-----------|----------|
| `book-lover.svg` | 默认 | 知识库 Hero、默认空状态 |
| `no-data.svg` | — | 空知识库、空文档 |
| `learning.svg` | 教育/培训/学校 | 教育行业 |
| `business.svg` | 商业/企业/管理 | 商业行业 |
| `medical.svg` | 医疗/医药/健康 | 医疗行业 |
| `finance.svg` | 金融/银行/投资 | 金融行业 |
| `technology.svg` | 科技/软件/编程 | 科技行业 |
| `innovation.svg` | AI/人工智能/创新 | AI 行业 |
| `analytics.svg` | 分析 | 分析页面 |
| `data.svg` | 数据 | 数据管理 |
| `schedule.svg` | — | 定时任务空状态 |
| `ai-chat.svg` | — | AI 模型空状态 |
| `network.svg` | — | 知识图谱空状态 |

### 智能匹配机制

```typescript
// lib/illustrations.ts
getIndustryIllustration("临床医学研究") → medical.svg  (匹配 "医" 关键词)
getIndustryIllustration("金融投资分析") → finance.svg  (匹配 "金融" 关键词)
getIndustryIllustration("未知领域")     → book-lover.svg (默认)
```

支持 40+ 中英文关键词自动匹配，映射到 8 个行业类别。

---

## 9. 主题与样式体系

### 9.1 色彩系统

采用 **oklch** 色彩空间，通过 CSS 变量实现 Light/Dark 双主题。

#### 核心颜色

| 语义 | Light | Dark | 用途 |
|------|-------|------|------|
| `--primary` | `oklch(0.55 0.2 264)` (靛蓝) | `oklch(0.65 0.16 264)` | 主交互色 |
| `--background` | `oklch(0.985 0.002 265)` | `oklch(0.145 0.005 265)` | 页面背景 |
| `--card` | `oklch(1 0 0)` (纯白) | `oklch(0.23 0.005 265)` | 卡片背景 |
| `--border` | `oklch(0.92 0.003 265)` | `oklch(1 0 0 / 8%)` | 边框 |
| `--muted-foreground` | `oklch(0.50 0.01 265)` | `oklch(0.55 0 0)` | 次要文字 |
| `--destructive` | `oklch(0.55 0.22 25)` (红) | `oklch(0.60 0.18 25)` | 危险操作 |

#### 行业专属色

```css
--industry-medical:     #10B981;  /* 绿 */
--industry-finance:     #3B82F6;  /* 蓝 */
--industry-legal:       #8B5CF6;  /* 紫 */
--industry-tech:        #06B6D4;  /* 青 */
--industry-education:   #F59E0B;  /* 黄 */
--industry-engineering: #EF4444;  /* 红 */
--industry-marketing:   #EC4899;  /* 粉 */
--industry-general:     #6B7280;  /* 灰 */
```

#### 图表色板 (5色)

```css
--chart-1: oklch(0.55 0.2 264);   /* 靛蓝 */
--chart-2: oklch(0.65 0.17 165);  /* 翠绿 */
--chart-3: oklch(0.55 0.15 300);  /* 紫色 */
--chart-4: oklch(0.75 0.15 85);   /* 金黄 */
--chart-5: oklch(0.60 0.2 25);    /* 红色 */
```

### 9.2 布局变量

```css
--sidebar-width: 240px;
--sidebar-collapsed: 64px;
--topbar-height: 48px;
--content-max-width: 1200px;
--content-padding: 32px;
--radius: 0.625rem;  /* 10px */
```

### 9.3 字体系统

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont,
             'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
```

**字体特性:**
- `font-feature-settings: 'cv01', 'cv02', 'cv03', 'cv04'` (Inter 字符变体)
- `letter-spacing: -0.011em` (正文), `-0.02em` (标题)
- `-webkit-font-smoothing: antialiased`

**代码字体:** `'JetBrains Mono', 'Fira Code', monospace` (ChatPanel 代码块)

### 9.4 阴影层级

| 层级 | Light | Dark |
|------|-------|------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | `none` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` | `none` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | `0 4px 16px rgba(0,0,0,0.4)` |
| `--shadow-lg` | `0 12px 40px rgba(0,0,0,0.12)` | `0 12px 40px rgba(0,0,0,0.5)` |

### 9.5 动画时序

```css
--duration-fast: 100ms;
--duration-normal: 150ms;
--duration-slow: 250ms;
--ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### 9.6 CSS 特效系统

| 特效 | 类名 | 用途 |
|------|------|------|
| **卡片辉光** | `.card-glow-{color}` | 卡片底部渐变光雾 (7色: indigo/blue/emerald/amber/violet/cyan/rose) |
| **Showcase 卡片** | `.card-showcase` | Raycast 风格深色渐变卡片 (6色变体) |
| **悬浮凸起** | `.card-raised` | 物理凸起阴影效果 |
| **呼吸动画** | `.animate-breathe` | 按钮脉动光晕 |
| **悬浮飘起** | `.hover-float` | hover 微上移 |
| **按钮扫光** | `.btn-shine` | hover 光泽扫过效果 |
| **Aurora 叠层** | `[data-slot="sidebar-inset"]::before` | 页面暖色渐变氛围光 |
| **Dashboard Grid** | `.dashboard-hero .grid-bg` | 网格背景 + 径向遮罩 |
| **Hero 标题** | `.hero-title-loader` | 逐字出现 + 彩色扫光动画 |
| **主题切换** | `::view-transition-*` | 圆形展开过渡 |

### 9.7 Claude Chat 面板独立主题

ChatPanel 使用独立的 CSS 变量体系，模仿 Claude Code 风格:

```css
.claude-chat {
  --cc-bg: #F5F5F0;           /* 温暖米色背景 */
  --cc-bg-elevated: #EDEDEA;
  --cc-fg: #1a1a18;
  --cc-fg-muted: #8a8a80;
  --cc-border: #e0e0d8;
  --cc-accent: #C15F3C;       /* Claude 橙色 */
  --cc-user-bg: #e8e8e2;
}
.dark .claude-chat {
  --cc-bg: #2b2a27;
  --cc-accent: #D4714E;       /* 暗色下偏亮 */
}
```

---

## 10. 状态管理

### Zustand Store

```typescript
// stores/useAppStore.ts
interface AppState {
  sidebarCollapsed: boolean;     // 侧边栏折叠
  mobileMenuOpen: boolean;       // 移动端菜单
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  currentModel: 'claude' | 'codex';
  commandPaletteOpen: boolean;   // ⌘K 命令面板
}

// 持久化到 localStorage (key: 'mutiexpert-app')
// 持久化字段: sidebarCollapsed, theme, currentModel
```

```typescript
// stores/useBreadcrumbStore.ts
// 动态面包屑标签管理 (如知识库详情页显示知识库名称)
```

### TanStack Query 缓存策略

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
```

**约定:**
- Query Key 格式: `['resource-type', id?]` (如 `['kb-documents', kbId]`)
- 更新后调用 `queryClient.invalidateQueries()` 刷新

---

## 11. API 服务层

### 基础配置

```typescript
// services/api.ts
const api = axios.create({
  baseURL: '/api/v1',      // ⚠️ 必须用相对路径
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
```

### 服务模块

| 服务 | 文件 | 核心方法 |
|------|------|----------|
| **API 基础** | `api.ts` | Axios 实例 + 错误拦截器 |
| **聊天** | `chatService.ts` | `createConversation()`, `listMessages()`, `streamMessage()` (SSE) |
| **仪表盘** | `dashboardService.ts` | `getOverview()`, `getGraphData()` |
| **行业** | `industryService.ts` | CRUD |
| **知识库** | `knowledgeBaseService.ts` | CRUD + `uploadDocument()` + `createLinkDocument()` + `createArticleDocument()` |
| **网络** | `networkService.ts` | 关系图数据 |
| **定时任务** | `scheduledTaskService.ts` | CRUD + `runNow()` |

### SSE 流式传输模式

```typescript
// chatService.ts — streamMessage()
function streamMessage(
  conversationId: string,
  content: string,
  onChunk: (text: string) => void,
  onSources: (sources: SourceReference[]) => void,
  onComplete: (messageId: string) => void,
  onError: (error: string) => void,
): () => void  // 返回取消函数
```

---

## 12. 动画体系

### Framer Motion 预设 (lib/animations.ts)

| 变量 | 效果 | 参数 |
|------|------|------|
| `pageVariants` | 页面进入/退出 | y: 8→0, opacity: 0→1, 200ms |
| `staggerContainer` | 列表子元素交错 | staggerChildren: 40ms |
| `staggerItem` | 列表项入场 | y: 10→0, opacity: 0→1, 200ms |
| `cardHover` | 卡片悬浮放大 | scale: 1.015, 150ms |
| `fadeIn` | 渐入 | opacity: 0→1, 200ms |
| `slideFromRight` | 右滑入 | x: 100%→0, 250ms |

### CSS 动画

| 关键帧 | 效果 |
|--------|------|
| `card-breathe` | 卡片呼吸脉动 (4s 循环) |
| `breathe` / `breathe-dark` | 按钮光晕脉动 (3s 循环) |
| `hero-letter-anim` | 标题逐字闪烁 (4s 循环) |
| `hero-glow-move` | Hero 光斑左右移动 (2s 交替) |
| `hero-glow-fade` | Hero 光斑渐隐 (4s 循环) |

---

## 13. TypeScript 类型定义

```typescript
// types/index.ts — 完整数据模型

Industry {
  id, name, description, icon, color, created_at, updated_at
}

KnowledgeBase {
  id, name, description, industry_id, industry?, document_count, created_at, updated_at
}

Document {
  id, knowledge_base_id, title,
  file_type: 'pdf' | 'docx' | 'md' | 'link' | 'article',
  file_url, file_size, source_url?, content_html?, content_text,
  chunk_count, status: 'uploading' | 'processing' | 'ready' | 'error',
  error_message?, created_at, updated_at
}

Conversation {
  id, title, knowledge_base_ids[], model_provider: 'claude' | 'codex',
  created_at, updated_at
}

Message {
  id, conversation_id, role: 'user' | 'assistant' | 'system',
  content, sources: SourceReference[], model_used, tokens_used, created_at
}

SourceReference {
  chunk_id, document_id, document_title, snippet, score
}

GraphData { nodes: GraphNode[], edges: GraphEdge[] }
GraphNode { id, label, industry, color, document_count }
GraphEdge { source, target, strength, relation_type, description }

Insight {
  id, title, content, related_kb_ids[], status: 'new' | 'reviewed' | 'archived' | 'pushed_to_feishu',
  created_at
}

DashboardOverview {
  total_knowledge_bases, total_documents, total_conversations, total_insights
}

AIModel { id, name, provider }

ScheduledTask {
  id, name, description?, cron_expression,
  task_type: 'skill_exec' | 'ai_query' | 'feishu_push',
  task_config: Record<string, unknown>, enabled,
  last_run_at?, last_run_status?, created_at, updated_at
}
```

---

## 14. 设计模式与开发约定

### 14.1 组件开发规范

```
1. 新组件优先复用 composed/ 目录下的组合组件
2. 需要新增 shadcn/ui 组件 → `npx shadcn@latest add <component>`
3. 业务组件放 composed/，页面专用组件放 pages/ 同目录
4. 禁止 `any` 类型 — tsconfig 开启 strict
5. 所有图标通过 @iconify/react 引用，不内联 SVG
```

### 14.2 样式约定

```
1. 优先使用 Tailwind 原子类
2. 需要 CSS 变量时用 oklch 色彩空间
3. cn() 函数合并条件类名: cn('base-class', condition && 'extra-class')
4. 响应式: 移动优先 (sm → md → lg)
5. 暗色模式: Tailwind dark: 前缀 + CSS 变量自动切换
```

### 14.3 数据流模式

```
┌─────────┐     ┌──────────────┐     ┌──────────┐
│ Component├────→│ TanStack Query├────→│ services/ │
│          │     │ useQuery()    │     │ api.ts    │
│          │     │ useMutation() │     │           │
└─────────┘     └──────────────┘     └──────────┘
       ↑
       │ 全局状态
  ┌────┴────┐
  │ Zustand  │
  │ Store    │
  └─────────┘
```

- **服务端数据** → TanStack Query (缓存、自动刷新)
- **UI 状态** → Zustand (主题、侧边栏、命令面板)
- **组件内状态** → useState (表单、临时 UI)

### 14.4 文件命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 页面 | PascalCase + Page 后缀 | `DashboardPage.tsx` |
| 组件 | PascalCase / kebab-case | `ChatPanel` / `chat-panel.tsx` |
| Hook | camelCase + use 前缀 | `useTheme.ts` |
| Store | camelCase + use 前缀 + Store 后缀 | `useAppStore.ts` |
| Service | camelCase + Service 后缀 | `chatService.ts` |
| 类型 | PascalCase 接口 | `KnowledgeBase`, `Document` |

### 14.5 VSCode 风格面板模式

项目中已实现的可复用模式 (KnowledgeDetailPage):

```typescript
// useResizablePanel — 拖拽缩放 Hook
const PANEL_MIN = 280;   // 最小宽度
const PANEL_MAX = 600;   // 最大宽度
const PANEL_DEFAULT = 380;

// 使用 Pointer Events API
// onPointerDown: 记录起点, setPointerCapture
// onPointerMove: 计算 delta, clamp(MIN, MAX)
// onPointerUp: releasePointerCapture

// 折叠态: 36px 窄条 + 竖排文字
```

---

## 15. 设计哲学与审美体系

### 15.1 产品定位与视觉基调

MutiExpert 是一个多行业知识管理平台，视觉风格定位为 **"专业工具感 + 温暖氛围光"**，融合以下三大标杆产品的设计语言：

| 标杆产品 | 借鉴要素 | 在本项目中的体现 |
|----------|----------|------------------|
| **Linear** | 线性设计、暗色优先、极简交互、渐变光效 | 暗色主题、卡片呼吸动画、Aurora 氛围光叠层 |
| **Raycast** | 深色渐变卡片、高饱和强调色、命令面板 | `.card-showcase` 系列、`CommandPalette` (⌘K) |
| **Notion** | 模块化内容、干净排版、知识库组织 | 知识库 → 文档层级、Tiptap 富文本编辑器 |

> **参考**: [Linear Design Trend](https://blog.logrocket.com/ux-design/linear-design/) · [SaaSUI.design](https://www.saasui.design/) · [SaaSFrame Dashboard Examples](https://www.saasframe.io/categories/dashboard)

### 15.2 设计原则 (Design Principles)

```
1. 内容优先 (Content First)
   UI 是内容的容器，不是主角。减少装饰噪音，让文档/数据/对话成为视觉焦点。

2. 渐进式复杂度 (Progressive Complexity)
   默认展示最简视图，高级功能通过折叠/展开/命令面板按需暴露。
   示例: 侧边栏折叠、AI 面板可收起、StatCard 可点击筛选。

3. 氛围感而非扁平 (Ambient, Not Flat)
   通过 Aurora 渐变叠层、卡片底部辉光、呼吸动画赋予界面"活"的感觉，
   但克制使用——每个页面最多 1-2 个动态元素。

4. 暗色优先设计 (Dark-First Design)
   所有新组件先在暗色模式下调试，再适配亮色。
   oklch 色彩空间确保两种模式下感知亮度一致。

5. 信息密度适中 (Balanced Information Density)
   参考 Linear 的紧凑感，但不像终端工具那样密集。
   行高 1.5、字号 13-14px、卡片间距 12-16px。
```

### 15.3 2025-2026 SaaS 设计趋势对照

本项目已采纳或计划采纳的行业趋势：

| 趋势 | 状态 | 项目实现 |
|------|------|----------|
| **Glassmorphism / Liquid Glass** | ✅ 已采纳 | ChatPanel 半透明背景、卡片底部模糊辉光 |
| **OKLCH 渐变** | ✅ 已采纳 | 全局色彩系统、Aurora 叠层、卡片辉光 |
| **微交互 (Micro-interactions)** | ✅ 已采纳 | 卡片悬浮、按钮扫光、列表交错入场 |
| **命令面板 (Command Palette)** | ✅ 已采纳 | ⌘K 全局命令面板 (cmdk) |
| **Bento Grid 布局** | ✅ 已采纳 | Dashboard 统计卡片网格 |
| **AI 原生交互** | ✅ 已采纳 | 知识库内嵌 AI 问答面板 (SSE 流式) |
| **View Transitions API** | ✅ 已采纳 | 主题切换圆形展开动画 |
| **可拖拽面板** | ✅ 已采纳 | VSCode 风格 AI 面板 (Pointer Events) |
| **动态极简主义** | ✅ 已采纳 | 干净布局 + 有节制的色彩点缀 + 微动画 |
| **Liquid Glass (Apple 2025)** | 🔜 可引入 | 可用于 Modal/Popover 背景 |
| **3D/空间化元素** | ❌ 不采纳 | 与知识管理工具调性不符 |

> **参考**: [UI Trends 2026 for SaaS](https://www.thefrontendcompany.com/posts/ui-trends) · [Top SaaS Design Trends 2026](https://www.designstudiouiux.com/blog/top-saas-design-trends/) · [15 UI/UX Design Trends 2026](https://www.wearetenet.com/blog/ui-ux-design-trends)

### 15.4 行业审美参考画廊

开发新页面时，可参考以下产品的对应模块：

| 场景 | 参考产品 | 要点 |
|------|----------|------|
| **Dashboard 总览** | Linear, Vercel Dashboard | 深色渐变 Hero + 统计卡片网格 + 趋势图 |
| **知识库列表** | Notion Database, Obsidian | 卡片/列表双视图、行业色标签、搜索筛选 |
| **文档详情** | Notion Page, Confluence | 三栏布局 (导航/内容/辅助面板) |
| **AI 对话** | Claude.ai, ChatGPT | 流式输出、Markdown 渲染、引用来源折叠 |
| **设置页** | Vercel Settings, GitHub Settings | Tab 导航、表单分组、危险操作区 |
| **命令面板** | Raycast, VS Code ⌘P | 模糊搜索、分组结果、键盘导航 |
| **空状态** | Linear Empty, Notion Empty | 插图 + 一句话说明 + 主操作按钮 |

---

## 16. 高级样式技法

### 16.1 Glassmorphism (磨玻璃效果)

项目中的磨玻璃实现方式及最佳实践：

**Tailwind 实现模板:**
```html
<!-- 基础磨玻璃卡片 -->
<div class="backdrop-blur-md bg-white/30 dark:bg-black/30
            border border-white/20 dark:border-white/10
            rounded-xl shadow-lg">
  <!-- 内容 -->
</div>
```

**关键规则:**
```
1. 用 backdrop-blur-{sm|md|lg}，不是 blur（blur 会模糊内容本身）
2. 背景透明度: 亮色 bg-white/20~40，暗色 bg-black/20~40
3. 边框: border-white/10~20 营造玻璃边缘感
4. 层级越深 → 模糊越强、透明度越高（模拟物理景深）
5. 文字对比度: 磨玻璃上的文字必须保证 WCAG AA 对比度
6. 性能: 移动端限制同屏磨玻璃元素 ≤3 个
```

**项目中已有的磨玻璃应用:**
- ChatPanel 的 Claude 风格背景 (`--cc-bg` 系列)
- 卡片底部辉光 (`[data-slot="card"]::after` + `filter: blur()`)
- Aurora 氛围叠层 (`[data-slot="sidebar-inset"]::before`)

> **参考**: [Glassmorphism with Tailwind CSS](https://flyonui.com/blog/glassmorphism-with-tailwind-css/) · [Liquid Glass in Tailwind](https://flyonui.com/blog/liquid-glass-effects-in-tailwind-css/) · [Gradienty Generator](https://gradienty.codes/tailwind-glassmorphism-generator)

### 16.2 OKLCH 渐变与 Aurora 光效

本项目全面采用 oklch 色彩空间，相比 sRGB/HSL 的核心优势：

```
sRGB 渐变:  红 → 蓝  中间会出现灰泥色 (muddy gray)
oklch 渐变: 红 → 蓝  中间过渡自然鲜艳 (perceptually uniform)
```

**Aurora 氛围光实现原理:**
```css
/* 多层径向渐变叠加 → 极光效果 */
background:
  radial-gradient(ellipse 70% 50% at 10% 5%,
    oklch(0.85 0.12 30 / 0.14) 0%, transparent 60%),   /* 暖橙 */
  radial-gradient(ellipse 50% 40% at 80% 10%,
    oklch(0.88 0.10 264 / 0.10) 0%, transparent 55%),  /* 靛蓝 */
  radial-gradient(ellipse 60% 50% at 50% 90%,
    oklch(0.87 0.08 300 / 0.06) 0%, transparent 50%);  /* 紫色 */
```

**oklch 参数速查:**
```
oklch(L C H / A)
  L = 亮度 0~1    (0.5=中等, 暗色模式降到 0.35-0.45)
  C = 色度 0~0.4  (0=灰, 0.2=鲜艳, 0.3+=极高饱和)
  H = 色相 0~360  (30=橙, 85=黄, 165=绿, 264=靛蓝, 300=紫, 25=红)
  A = 透明度      (Aurora 用 0.06-0.15 的低透明度)
```

**暗色模式适配规则:**
```
亮色 oklch(0.85 0.12 H / 0.14)  →  暗色 oklch(0.40 0.12 H / 0.06)
规律: L 降 40-50%, A 降 50-60%, C 和 H 保持不变
```

**CSS 渐变插值 (进阶):**
```css
/* 在 oklch 空间插值，避免灰泥过渡 */
background: linear-gradient(in oklch, oklch(0.7 0.2 30), oklch(0.7 0.2 264));

/* longer hue = 走色相环长弧，产生彩虹/极光效果 */
background: linear-gradient(in oklch longer hue, oklch(0.7 0.15 30), oklch(0.7 0.15 300));
```

> **参考**: [OKLCH in CSS (Evil Martians)](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) · [OKLCH Color Picker](https://oklch.org/) · [MDN oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch)

### 16.3 微交互动画最佳实践

**Framer Motion (motion/react) 配置指南:**

```typescript
// Spring vs Tween 选择
// 物理属性 (x, y, scale, rotate) → 默认 spring，更自然
// 视觉属性 (opacity, color)      → 默认 tween，更可控

// 推荐 spring 参数
const snappy = { type: 'spring', stiffness: 300, damping: 20 };  // 按钮点击
const gentle = { type: 'spring', stiffness: 120, damping: 14 };  // 面板滑入
const bouncy = { type: 'spring', stiffness: 400, damping: 10 };  // 弹跳效果

// 推荐 tween 参数
const quick  = { duration: 0.15, ease: 'easeOut' };   // 微交互
const normal = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }; // 页面过渡
```

**时长规范:**
```
50-100ms   → 即时反馈 (hover 高亮、active 按压)
150-250ms  → 微交互 (按钮动画、tooltip 出现、卡片悬浮)
250-400ms  → 中等过渡 (面板展开、页面切换、模态框)
400-600ms  → 大型动画 (首屏入场、复杂编排)
> 600ms    → 仅用于 Hero 展示动画，交互中禁止
```

**项目中的微交互清单:**

| 交互 | 动画 | 实现 |
|------|------|------|
| 卡片 hover | scale 1.015 + translateY -2px | `cardHover` + `.hover-float` |
| 按钮 hover | 光泽扫过 | `.btn-shine::after` |
| 列表入场 | 交错渐入 (40ms 间隔) | `staggerContainer` + `staggerItem` |
| 页面切换 | y: 8→0 + opacity 渐入 | `pageVariants` |
| 面板滑入 | x: 100%→0 | `slideFromRight` |
| 卡片静息 | 阴影呼吸脉动 (4s) | `@keyframes card-breathe` |
| 主题切换 | 圆形展开 | `::view-transition-*` |
| AI 打字 | 光标闪烁 | `animate-pulse` on cursor span |
| Hero 标题 | 逐字出现 + 彩色扫光 | `hero-letter-anim` + `hero-glow-*` |

**无障碍 (a11y) 要求:**
```css
/* 必须尊重用户的减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

> **参考**: [Framer Motion Best Practices](https://www.ruixen.com/blog/react-anim-framer-spring) · [Micro Animations in React](https://jcofman.de/blog/micro-animations) · [Motion.dev](https://motion.dev)

### 16.4 卡片辉光系统详解

项目独创的多层卡片视觉系统：

```
┌─────────────────────────────────┐
│  [data-slot="card"]             │  ← 基础卡片 (border + 呼吸动画)
│  ┌───────────────────────────┐  │
│  │  ::after (底部辉光)        │  │  ← 径向渐变 + blur(10-16px)
│  │  oklch 色彩 + 低透明度     │  │
│  └───────────────────────────┘  │
│                                 │
│  .card-glow-{color}             │  ← 7 色变体 (indigo/blue/emerald/amber/violet/cyan/rose)
│  .card-showcase                 │  ← Raycast 风格深色渐变 (6 色变体)
│  .card-raised                   │  ← 物理凸起阴影
│  .card-hover                    │  ← hover 时放大 + 增强辉光
└─────────────────────────────────┘
```

**使用决策:**
```
普通内容卡片     → 默认 [data-slot="card"]，不加额外类
重点展示卡片     → .card-glow-{行业色}
Hero/Showcase    → .card-showcase-{色调}
可交互卡片       → 加 .card-hover
物理凸起感       → .card-raised (慎用，仅 Dashboard Hero)
```

### 16.5 样式技法速查表

| 效果 | Tailwind 类 / CSS | 适用场景 |
|------|-------------------|----------|
| 磨玻璃 | `backdrop-blur-md bg-white/30 border-white/20` | Modal、Popover、浮层 |
| 柔光阴影 | `shadow-lg shadow-primary/10` | 悬浮卡片 |
| 渐变文字 | `bg-gradient-to-r from-primary to-chart-3 bg-clip-text text-transparent` | Hero 标题 |
| 内发光边框 | `ring-1 ring-primary/20` | 选中态卡片 |
| 条件暗色 | `dark:bg-card dark:border-white/8` | 所有组件 |
| 色彩叠层 | `relative` + `::before` 伪元素 + `radial-gradient` | 页面氛围光 |
| 平滑过渡 | `transition-all duration-200 ease-out` | 通用交互 |
| 弹性缩放 | `transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)` | 按钮/卡片 |

---

## 17. Claude Code Skills 前端编排体系

### 17.1 编排概述

项目使用 `/skill-orchestrator` 自动评估任务复杂度并分配工作流。

**前端任务工作流:**

| 复杂度 | 典型场景 | 工作流 |
|--------|----------|--------|
| 低 | 改样式、修 bug、加字段 | @frontend-dev → @tester |
| 中 | 新页面、组件重构 | @researcher → @frontend-dev → @reviewer → @tester |
| 高 | 新模块、全栈、架构变更 | @researcher → @architect → @designer → @frontend-dev → @reviewer/@tester |

### 17.2 前端相关 Agent 角色

| 角色 | 职责 | 核心 Skills | 模型 |
|------|------|-------------|------|
| **@designer** | 视觉设计、主题、配色 | `/canvas-design` `/theme-factory` `/UIUX设计增强` `/placeholder-image` | Sonnet |
| **@frontend-dev** | 页面编码、组件开发 | `/frontend-design` `/web-artifacts-builder` `/ui-ux-pro-max` `/analyze-routes` `/fe-optimize` | Sonnet |
| **@reviewer** | 代码审查、质量门禁 | `/audit-project` `/code-review` `/deslop` | Opus |
| **@tester** | 功能验证、E2E 测试 | `/webapp-testing` `/verification-before-completion` | Haiku |

### 17.3 前端 Skills 详解

| Skill | 何时用 | 输出 |
|-------|--------|------|
| `/frontend-design` | 新建页面、组件、UI 美化 | 生产级 React + Tailwind + shadcn/ui 代码，避免 AI 通用审美 |
| `/web-artifacts-builder` | 复杂多组件页面 (状态管理/路由/40+ shadcn 组件) | 完整 React18+TS+Vite+Tailwind 应用骨架 |
| `/ui-ux-pro-max` | 设计决策 — 选配色/字体/布局/风格 | 50+ 风格库、97 色板、57 字体对、99 UX 规则、9 技术栈适配 |
| `/fe-optimize` | 页面卡顿、包体积大、渲染慢 | 6 维扫描: API 调用/缓存策略/渲染性能/Bundle 分析/网络优化/综合评分 |
| `/analyze-routes` | 路由梳理、接口盘点 | 自动扫描路由树/API 调用/Mock 数据使用情况 |
| `/theme-factory` | 主题定制、品牌换肤 | 10 预设主题 (Arctic Frost / Midnight Galaxy / Desert Rose 等)，含完整色板+字体方案 |
| `/canvas-design` | 海报、视觉稿、品牌物料 | 博物馆/杂志级 PNG/PDF 多页输出 |
| `/webapp-testing` | 功能验证、截图对比 | Playwright 自动化浏览器测试 + 截图 |
| `/code-review` | PR 审查、代码质量 | Sentry 团队标准 Checklist (安全/性能/测试/设计) |
| `/deslop` | 清理 AI 生成的冗余代码 | 检测 console.log / TODO / 死代码 / AI 痕迹，分 3 阶段清理 |
| `/verification-before-completion` | 提交前验证 | 强制运行验证命令，证据优先，禁止虚假完成声明 |

### 17.4 前端开发 Skill 选择决策树

```
收到前端需求
  │
  ├── 需求模糊？ → /requirement-alignment 对齐
  │
  ├── 涉及新技术/库？ → /web-search-plus 调研
  │
  ├── 需要设计决策？
  │     ├── 配色/字体/风格 → /ui-ux-pro-max
  │     ├── 主题换肤 → /theme-factory
  │     └── 视觉稿/海报 → /canvas-design
  │
  ├── 开始编码
  │     ├── 新页面/组件 → /frontend-design
  │     ├── 复杂多组件应用 → /web-artifacts-builder
  │     └── 路由/接口盘点 → /analyze-routes
  │
  ├── 代码完成
  │     ├── 代码审查 → /code-review
  │     ├── 清理冗余 → /deslop
  │     ├── 性能检查 → /fe-optimize
  │     └── 功能验证 → /webapp-testing
  │
  └── 提交前 → /verification-before-completion
```

### 17.5 Skill 加载优先级

```
优先级 1: 项目命令  .claude/commands/*          ← 最高，同名覆盖全局
优先级 2: 全局命令  C:\Users\33813\.claude\commands\*
优先级 3: 在线搜索  /web-search-plus → GitHub
```

### 17.6 AI 前端代码生成提示词指南

#### 问题: "AI Slop" 审美

AI 生成的 UI 会趋同于 "所有 Tailwind 教程的中位数"——Inter 字体、紫色渐变、白色背景、圆角卡片。
本项目通过 `/frontend-design` Skill + 以下提示词策略打破这种趋同。

#### 核心反模式 (必须避免)

```
❌ 字体: Inter, Roboto, Arial, Open Sans, Lato, 系统默认字体
❌ 配色: 紫色渐变 + 白色背景、胆怯的均匀分布色板
❌ 布局: 千篇一律的网格、缺乏上下文特征的模板
❌ 动画: 零散的微交互，而非有编排的整体动效
```

#### 提示词模板: 前端审美增强

将以下内容放入 CLAUDE.md 或作为 Skill 的 reference:

```xml
<frontend_aesthetics>
避免 AI 通用审美。做出有创意、有辨识度的前端设计。

Typography: 选择独特字体，禁用 Inter/Roboto/Arial。
  - 代码感: JetBrains Mono, Fira Code, Space Grotesk
  - 编辑感: Playfair Display, Crimson Pro, Fraunces
  - 创业感: Clash Display, Satoshi, Cabinet Grotesk
  - 技术感: IBM Plex family, Source Sans 3
  字重对比用极端值: 100/200 vs 800/900，不是 400 vs 600。

Color: 用 CSS 变量保持一致性。主色 + 锐利强调色 > 胆怯均匀色板。
  从 IDE 主题和文化美学中汲取灵感。

Motion: 聚焦高影响力时刻——一个精心编排的页面加载 (staggered reveals)
  比零散的微交互更令人愉悦。优先 CSS-only，React 用 Motion 库。

Backgrounds: 营造氛围和深度，不要默认纯色。
  叠加 CSS 渐变、几何图案、或与整体美学匹配的上下文效果。
</frontend_aesthetics>
```

#### 高效提示词示例

```
// ❌ 模糊的提示
"做一个好看的 Dashboard"

// ✅ 具体的提示
"做一个 Linear 风格的 Dashboard:
 - 深色背景 (oklch 0.145)，不用纯黑
 - 统计卡片用 card-glow-indigo 辉光效果
 - Hero 区域用 Aurora 渐变氛围光
 - 字体: 标题用 font-bold tracking-tight，数据用 tabular-nums
 - 参考项目已有的 DashboardPage 和 stat-card 组件"
```

```
// ❌ 没有约束
"加一个设置页面"

// ✅ 有约束
"新建设置页面，遵循项目规范:
 - 使用 SettingsLayout Tab 导航模式
 - 表单用 shadcn/ui Input + Select + Switch
 - 图标用 streamline-color: 前缀
 - 危险操作区用 destructive 色 + ConfirmDialog
 - 参考 AIModelsPage 的布局结构"
```

#### 提示词关键技巧

```
1. 锚定参考: 指定项目中已有的页面/组件作为参照物
2. 指定图标集: "用 streamline-color:xxx" 而非 "加个图标"
3. 指定色彩系统: "用 card-glow-indigo" 而非 "加个蓝色效果"
4. 指定组件: "用 SolidButton color='indigo'" 而非 "加个按钮"
5. 先 Plan 再 Code: 复杂 UI 先进 Plan Mode 审查设计方向
6. 分维度指导: 分别指定字体、配色、动画、背景，不要笼统说 "好看"
```

> **参考**: [Claude Frontend Aesthetics Cookbook](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics) · [Breaking the AI Slop Aesthetic](https://paddo.dev/blog/claude-code-plugins-frontend-design/) · [11 Prompting Tips for UIs](https://www.builder.io/blog/prompting-tips) · [Claude Blog: Improving Frontend Design](https://claude.com/blog/improving-frontend-design-through-skills)

### 17.7 前端设计灵感资源库

#### 标杆产品 (直接参考)

| 产品 | 风格关键词 | 参考价值 |
|------|-----------|----------|
| [Linear](https://linear.app) | 暗色优先、渐变光效、极简交互 | Dashboard、列表页、空状态 |
| [Vercel Dashboard](https://vercel.com/dashboard) | 信息密集、快速、开发者工具感 | 部署状态、日志、设置页 |
| [Raycast](https://raycast.com) | 深色渐变、高饱和强调色、命令面板 | 命令面板、Showcase 卡片 |
| [Notion](https://notion.so) | 模块化、干净排版、知识库 | 文档编辑、知识库组织 |
| [Obsidian](https://obsidian.md) | 图谱可视化、本地优先、插件生态 | 知识图谱、Markdown 编辑 |
| [Claude.ai](https://claude.ai) | 温暖色调、流式输出、引用来源 | AI 对话面板 |

#### 设计灵感平台

| 平台 | 链接 | 用途 |
|------|------|------|
| SaaSUI.design | https://www.saasui.design/ | SaaS 产品 UI 模式库 |
| SaaSFrame | https://www.saasframe.io/categories/dashboard | 163+ Dashboard 示例 |
| Saaspo (Dark Mode) | https://saaspo.com/style/dark-mode | 暗色 SaaS Landing Page |
| Mobbin | https://mobbin.com/ | 真实产品 UI 流程截图 |
| Behance | https://www.behance.net/ | 专业设计师作品集 |
| Dribbble | https://dribbble.com/ | UI 概念设计 |
| Awwwards | https://www.awwwards.com/ | 获奖网站动效参考 |
| Layers | https://layers.to/ | Dribbble 替代品，更现代 |

#### shadcn/ui 生态资源

| 资源 | 链接 | 说明 |
|------|------|------|
| AllShadcn | https://allshadcn.com/ | 300+ 模板/组件/工具聚合 |
| ShadcnBlocks | https://www.shadcnblocks.com/templates | 高质量 shadcn 模板 |
| ShadcnUIKit | https://shadcnuikit.com/ | Dashboard + UI Blocks |
| Awesome Shadcn | https://shadcn.batchtool.com/components | 社区组件精选 |
| shadcn/ui 生态指南 2025 | https://www.devkit.best/blog/mdx/shadcn-ui-ecosystem-complete-guide-2025 | 11 个新组件库 |

#### 暗色模式设计原则

```
1. 不用纯黑 #000000 → 用深灰 oklch(0.145 0.005 265)，减少刺眼对比
2. 不用纯白 #FFFFFF 文字 → 用 oklch(0.92 0 0)，避免视觉振动
3. 边框用 oklch(1 0 0 / 8%) 而非实色灰，更通透
4. 阴影在暗色下无效 → 改用边框发光 (ring/glow) 表达层级
5. 强调色亮度提升 15-20% → 暗色下 oklch L 从 0.55 提到 0.65
6. 渐变辉光更明显 → 暗色下 ::after 辉光透明度可提高 40%
```

> **参考**: [Dark Mode Dashboard Principles](https://www.qodequay.com/dark-mode-dashboards) · [Vercel: Developer Experience as Design](https://blakecrosley.com/guides/design/vercel) · [Linear Style Design](https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646)

---

## 18. 链接引用

### 技术文档

| 技术 | 文档链接 |
|------|----------|
| React 19 | https://react.dev/ |
| TypeScript | https://www.typescriptlang.org/docs/ |
| Vite | https://vite.dev/ |
| Tailwind CSS 4 | https://tailwindcss.com/docs |
| shadcn/ui | https://ui.shadcn.com/ |
| Radix UI | https://www.radix-ui.com/ |
| Zustand | https://zustand.docs.pmnd.rs/ |
| TanStack Query | https://tanstack.com/query/latest |
| React Router | https://reactrouter.com/ |
| Framer Motion | https://motion.dev/ |
| Tiptap Editor | https://tiptap.dev/ |
| Cytoscape.js | https://js.cytoscape.org/ |
| Recharts | https://recharts.org/ |
| Axios | https://axios-http.com/ |
| react-markdown | https://github.com/remarkjs/react-markdown |
| Sonner | https://sonner.emilkowal.ski/ |
| CVA | https://cva.style/ |
| cmdk | https://cmdk.paco.me/ |

### 图标与插图资源

| 资源 | 链接 |
|------|------|
| Iconify 图标搜索 | https://icon-sets.iconify.design/ |
| Lucide 图标集 | https://lucide.dev/icons/ |
| Streamline Icons | https://www.streamlinehq.com/ |
| Storyset 插图 | https://storyset.com/ |

### 设计趋势与灵感

| 资源 | 链接 |
|------|------|
| SaaSUI.design (SaaS UI 模式库) | https://www.saasui.design/ |
| SaaSFrame (Dashboard 示例) | https://www.saasframe.io/categories/dashboard |
| Linear Design Trend 分析 | https://blog.logrocket.com/ux-design/linear-design/ |
| UI Trends 2026 for SaaS | https://www.thefrontendcompany.com/posts/ui-trends |
| Top SaaS Design Trends 2026 | https://www.designstudiouiux.com/blog/top-saas-design-trends/ |
| 15 UI/UX Design Trends 2026 | https://www.wearetenet.com/blog/ui-ux-design-trends |

### 样式技法参考

| 资源 | 链接 |
|------|------|
| OKLCH in CSS (Evil Martians) | https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl |
| OKLCH Color Picker | https://oklch.org/ |
| MDN oklch() | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch |
| Glassmorphism with Tailwind | https://flyonui.com/blog/glassmorphism-with-tailwind-css/ |
| Liquid Glass in Tailwind | https://flyonui.com/blog/liquid-glass-effects-in-tailwind-css/ |
| Gradienty (渐变生成器) | https://gradienty.codes/tailwind-glassmorphism-generator |
| Holographic CSS Effects | https://blog.openreplay.com/creating-holographic-effects-css/ |
| Framer Motion Best Practices | https://www.ruixen.com/blog/react-anim-framer-spring |
| Micro Animations in React | https://jcofman.de/blog/micro-animations |

### AI 前端提示词参考

| 资源 | 链接 |
|------|------|
| Claude Frontend Aesthetics Cookbook | https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics |
| Breaking the AI Slop Aesthetic | https://paddo.dev/blog/claude-code-plugins-frontend-design/ |
| Claude Blog: Improving Frontend Design | https://claude.com/blog/improving-frontend-design-through-skills |
| 11 Prompting Tips for UIs | https://www.builder.io/blog/prompting-tips |
| UX Psychology + Frontend Design | https://jangwook.net/en/blog/en/ux-psychology-frontend-design-skill/ |
| Prompt Engineering for Claude Code | https://developertoolkit.ai/en/claude-code/productivity-patterns/prompt-engineering/ |

### 项目相关

| 资源 | 说明 |
|------|------|
| 部署地址 | `120.76.158.129:8080` (阿里云) |
| 后端 API | FastAPI + PostgreSQL + pgvector |
| CI/CD | GitHub Actions → Docker Compose |
| API 基础路径 | `/api/v1` (相对路径，Vite 代理到 :8000) |

---

> **使用指南**: AI 在开发新页面/模块时，应优先参考本文档确认:
> 1. 是否有可复用的 composed 组件 (第 6 章)
> 2. 图标应使用哪个集合 — lucide: 交互控件 / streamline-color: 功能标识 (第 7 章)
> 3. 颜色使用 oklch CSS 变量，渐变用 `in oklch` 插值 (第 9、16 章)
> 4. 数据获取用 TanStack Query，全局状态用 Zustand (第 10 章)
> 5. 动画时长 150-250ms 微交互 / 250-400ms 过渡，尊重 prefers-reduced-motion (第 16 章)
> 6. 新增 shadcn 组件: `npx shadcn@latest add <name>`
> 7. 复杂任务走 Skill 编排: 评估复杂度 → 匹配角色 → 调用对应 Skill (第 17 章)
> 8. 避免 AI Slop 审美: 锚定项目已有组件，指定图标集/色彩/字体，不说 "好看" (第 17.6 章)
> 9. 找灵感: 参考标杆产品 (Linear/Vercel/Raycast) 和灵感平台 (第 17.7 章)
