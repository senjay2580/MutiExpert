# MutiExpert 前端全面重构升级 — 执行提示词计划

> 生成时间: 2026-02-20
> 角色链: @researcher → @architect → @designer → @frontend-dev
> 复杂度: 高 (完整流)

---

## 一、项目现状诊断

### 1.1 当前技术栈
| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.2.0 |
| 构建 | Vite | 7.3.1 |
| 路由 | React Router | 7.13.0 |
| 状态 | Zustand | 5.0.11 |
| 数据获取 | TanStack Query | 5.90.21 |
| 样式 | Tailwind CSS | 4.2.0 + 自定义 CSS Variables |
| 图标 | Lucide React | 0.574.0 |
| 富文本 | Tiptap | 3.20.0 |
| 图表 | Recharts 3.7.0 + Cytoscape 3.33.1 |

### 1.2 现有组件清单（38 个文件）

```
frontend/src/
├── layouts/ (4)
│   ├── AppLayout.tsx          — 主布局容器
│   ├── Sidebar.tsx            — 侧栏导航（7 个菜单项）
│   ├── Header.tsx             — 顶部标题栏 + 搜索
│   └── SettingsLayout.tsx     — 设置页 Tab 布局
│
├── pages/ (11)
│   ├── dashboard/DashboardPage.tsx     — 仪表盘（统计卡片+AI用量+热力图+时间线）
│   ├── knowledge/KnowledgePage.tsx     — 知识库列表（行业分类树+搜索）
│   ├── knowledge/KnowledgeDetailPage.tsx — 知识库详情（文档上传+链接+富文本）
│   ├── chat/ChatListPage.tsx           — 对话列表（新建对话弹窗）
│   ├── chat/ChatConversationPage.tsx   — 对话详情（流式消息+Markdown+引用）
│   ├── skills/SkillsPage.tsx           — 技能管理（卡片网格+CRUD+执行）
│   ├── scheduler/ScheduledTasksPage.tsx — 定时任务（任务卡片+Cron预设）
│   ├── analytics/AnalyticsPage.tsx     — 数据分析（Recharts+洞察列表）
│   ├── settings/AIModelsPage.tsx       — AI模型配置
│   ├── settings/IntegrationsPage.tsx   — 飞书集成配置
│   └── settings/DataManagementPage.tsx — 数据管理
│
├── components/ (2 — 极度缺乏!)
│   ├── editor/TiptapEditor.tsx  — 富文本编辑器
│   └── ui/ThemeToggle.tsx       — 主题切换
│
├── 页面内私有子组件 (15+ 散落各处)
│   DashboardPage: UsageRow, HeatmapBar
│   KnowledgePage: IndustryBtn, KBRow, KBEmptyState
│   KnowledgeDetailPage: FormCard, StatBadge, DocRow
│   ChatListPage: EmptyState, ConversationRow
│   ChatConversationPage: EmptyState, MessageBubble
│   SkillsPage: SkillCard, Modal
│   ScheduledTasksPage: TaskCard, CreateModal
│   IntegrationsPage: Field
│   DataManagementPage: StatCard
│
├── services/ (8) — API 层，无需重构
├── stores/ (1) — useAppStore.ts
├── hooks/ (1) — useTheme.ts
├── types/ (1) — index.ts
└── routes/ (1) — index.tsx
```

### 1.3 核心问题诊断

| # | 问题 | 严重度 | 表现 |
|---|------|--------|------|
| P1 | **零组件库** | 🔴 严重 | 所有 UI 元素手工拼 Tailwind class，没有统一的 Button/Card/Input/Modal |
| P2 | **样式内联泛滥** | 🔴 严重 | 大量 `style={{ background: 'var(--xxx)' }}`、`onMouseEnter/Leave` 手动管理 hover |
| P3 | **私有组件散落** | 🟡 中等 | 15+ 个子组件直接定义在页面文件内，无法复用 |
| P4 | **重复模式** | 🟡 中等 | Modal、EmptyState、Loading、Card 每个页面重复实现 |
| P5 | **缺乏动画** | 🟡 中等 | 无页面过渡、无列表入场动画、hover 仅变色无 scale/transform |
| P6 | **CSS 变量命名非标准** | 🟠 低 | 自定义命名（--bg-surface, --text-primary），与 shadcn 的 --background/--foreground 体系不兼容 |
| P7 | **响应式粗糙** | 🟠 低 | 只有 sm(640px) 一个断点，移动端体验差 |
| P8 | **无骨架屏** | 🟠 低 | Loading 只有旋转图标，无 Skeleton 占位 |

---

## 二、目标架构设计

### 2.1 新增依赖

```bash
# shadcn/ui 基础设施（通过 CLI 安装组件，不是 npm 包）
npx shadcn@latest init

# 动画层
npm install motion                    # Framer Motion v12 (重命名为 motion)

# 工具增强
npm install tailwind-merge            # 智能合并 Tailwind class
npm install class-variance-authority  # 组件变体管理 (cva)

# 可选增强（按需）
npm install @radix-ui/react-slot      # shadcn 底层依赖
npm install cmdk                      # Command 命令面板（全局搜索）
```

### 2.2 目录结构升级

```
frontend/src/
├── components/
│   ├── ui/                    ← shadcn/ui 原子组件（通过 CLI 生成）
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx         (替代所有自制 Modal)
│   │   ├── sheet.tsx          (移动端侧栏抽屉)
│   │   ├── dropdown-menu.tsx
│   │   ├── command.tsx        (全局搜索 ⌘K)
│   │   ├── badge.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx / sonner.tsx
│   │   ├── tabs.tsx
│   │   ├── toggle.tsx
│   │   ├── tooltip.tsx
│   │   ├── avatar.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── collapsible.tsx
│   │   ├── switch.tsx
│   │   ├── table.tsx
│   │   ├── progress.tsx
│   │   └── chart.tsx          (基于 Recharts 的 shadcn chart)
│   │
│   ├── composed/              ← 业务复合组件（由 ui/ 组合而成）
│   │   ├── stat-card.tsx      (Dashboard 统计卡片)
│   │   ├── empty-state.tsx    (通用空状态)
│   │   ├── page-header.tsx    (页面标题 + 操作按钮)
│   │   ├── search-bar.tsx     (通用搜索输入框)
│   │   ├── confirm-dialog.tsx (确认弹窗)
│   │   ├── data-table.tsx     (通用数据表格)
│   │   ├── loading-skeleton.tsx (各场景骨架屏)
│   │   ├── message-bubble.tsx (聊天消息气泡)
│   │   ├── skill-card.tsx     (技能卡片)
│   │   ├── task-card.tsx      (任务卡片)
│   │   └── industry-badge.tsx (行业标签)
│   │
│   ├── layout/                ← 布局组件
│   │   ├── app-layout.tsx
│   │   ├── app-sidebar.tsx    (用 shadcn Sidebar 重写)
│   │   ├── app-header.tsx
│   │   ├── settings-layout.tsx
│   │   └── page-container.tsx (统一页面内容容器)
│   │
│   └── editor/                ← 富文本
│       └── tiptap-editor.tsx
│
├── lib/
│   └── utils.ts               ← cn() 工具函数 (clsx + twMerge)
│
├── hooks/
│   ├── use-theme.ts
│   ├── use-mobile.ts          ← 响应式断点 hook
│   └── use-debounce.ts        ← 搜索防抖
│
├── styles/
│   └── globals.css            ← shadcn 主题变量 + 自定义扩展
│
├── pages/                     ← 页面组件（只含布局编排，不含 UI 实现）
├── services/                  ← 不变
├── stores/                    ← 不变
├── types/                     ← 不变
└── routes/                    ← 不变
```

### 2.3 主题系统设计

#### 色板定义（OKLCH 色彩空间 + shadcn 标准命名）

```css
/* globals.css — 新主题系统 */
@import "tailwindcss";

@theme inline {
  /* === shadcn 标准命名映射 === */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar-background: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-accent: var(--sidebar-accent);

  /* === 圆角阶梯 === */
  --radius-sm: 0.25rem;   /* 小元素: Badge, Tag */
  --radius-md: 0.375rem;  /* 中元素: Input, Button */
  --radius-lg: 0.5rem;    /* 大元素: Card, Dialog */
  --radius-xl: 0.75rem;   /* 特大: 页面容器 */
}

:root {
  /* Light Theme — 暖橙品牌色 (Claude-style) */
  --background: oklch(0.985 0.002 90);      /* 页面底色 */
  --foreground: oklch(0.145 0.015 285);     /* 主文本 */

  --card: oklch(1 0 0);                     /* 卡片白 */
  --card-foreground: oklch(0.145 0.015 285);

  --primary: oklch(0.65 0.15 45);           /* D97757 暖橙 → OKLCH */
  --primary-foreground: oklch(0.985 0.002 90);

  --secondary: oklch(0.96 0.005 260);       /* 淡灰蓝 */
  --secondary-foreground: oklch(0.25 0.015 260);

  --muted: oklch(0.96 0.005 260);
  --muted-foreground: oklch(0.55 0.015 260);

  --accent: oklch(0.96 0.005 260);
  --accent-foreground: oklch(0.25 0.015 260);

  --destructive: oklch(0.55 0.2 25);
  --border: oklch(0.92 0.004 260);
  --input: oklch(0.92 0.004 260);
  --ring: oklch(0.65 0.15 45);             /* 与 primary 一致 */

  /* Sidebar 专属 */
  --sidebar-background: oklch(0.985 0.002 90);
  --sidebar-foreground: oklch(0.45 0.015 260);
  --sidebar-primary: oklch(0.65 0.15 45);
  --sidebar-accent: oklch(0.96 0.03 45);

  /* === 项目特色: 行业色 (保留) === */
  --industry-medical: oklch(0.7 0.17 165);
  --industry-finance: oklch(0.6 0.17 255);
  --industry-legal: oklch(0.58 0.2 295);
  --industry-tech: oklch(0.65 0.15 200);
  --industry-education: oklch(0.75 0.15 85);
  --industry-engineering: oklch(0.6 0.2 25);
  --industry-marketing: oklch(0.65 0.22 340);
  --industry-general: oklch(0.55 0.015 260);

  /* === 语义色 === */
  --success: oklch(0.7 0.17 165);
  --warning: oklch(0.8 0.15 85);
  --error: oklch(0.6 0.2 25);
  --info: oklch(0.6 0.17 255);

  /* === 阴影 === */
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.04);
  --shadow-md: 0 4px 12px oklch(0 0 0 / 0.07);
  --shadow-lg: 0 12px 40px oklch(0 0 0 / 0.1);
}

.dark {
  --background: oklch(0.08 0.005 260);
  --foreground: oklch(0.97 0.002 90);

  --card: oklch(0.13 0.005 260);
  --card-foreground: oklch(0.97 0.002 90);

  --primary: oklch(0.7 0.14 45);
  --primary-foreground: oklch(0.08 0.005 260);

  --secondary: oklch(0.18 0.005 260);
  --secondary-foreground: oklch(0.9 0.005 260);

  --muted: oklch(0.18 0.005 260);
  --muted-foreground: oklch(0.65 0.01 260);

  --accent: oklch(0.18 0.005 260);
  --accent-foreground: oklch(0.9 0.005 260);

  --destructive: oklch(0.65 0.2 25);
  --border: oklch(0.22 0.005 260);
  --input: oklch(0.22 0.005 260);
  --ring: oklch(0.7 0.14 45);

  --sidebar-background: oklch(0.1 0.005 260);
  --sidebar-foreground: oklch(0.7 0.01 260);
  --sidebar-primary: oklch(0.7 0.14 45);
  --sidebar-accent: oklch(0.18 0.02 45);
}
```

#### 排版系统

```
字号阶梯 (Tailwind classes):
  text-xs   → 12px  — 辅助说明、Badge、时间戳
  text-sm   → 14px  — 正文、表单标签、菜单项
  text-base → 16px  — 页面标题
  text-lg   → 18px  — 区域标题
  text-xl   → 20px  — 页面大标题
  text-2xl  → 24px  — 统计数字
  text-3xl  → 30px  — Hero 数字

字重:
  font-normal (400) — 正文
  font-medium (500) — 标签、菜单
  font-semibold (600) — 小标题、按钮
  font-bold (700) — 大数字、主标题

字体栈:
  Inter, -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif
```

#### 间距系统

```
使用 Tailwind 的 4px 基准:
  gap-1 (4px)   — 图标与文字间距
  gap-2 (8px)   — 紧凑元素间距
  gap-3 (12px)  — 列表项间距
  gap-4 (16px)  — 卡片内边距
  gap-6 (24px)  — 区块间距
  gap-8 (32px)  — 页面级间距

页面内容:
  padding: p-4 (mobile) / p-6 (sm) / p-8 (lg)
  max-width: max-w-7xl (1280px)
```

---

## 三、组件升级对照表

### 3.1 shadcn/ui 组件安装清单

```bash
# 批量安装（按重构优先级排序）
npx shadcn@latest add button card input textarea badge skeleton
npx shadcn@latest add dialog sheet dropdown-menu command
npx shadcn@latest add tabs toggle tooltip separator scroll-area
npx shadcn@latest add table select switch avatar collapsible
npx shadcn@latest add toast progress sidebar chart
```

### 3.2 组件替换映射

| 现有实现 | 替换为 | 影响页面 |
|---------|--------|---------|
| 手写 `<div className="rounded-xl p-5 bg-surface border">` | `<Card>` + `<CardHeader>` + `<CardContent>` | 全部 |
| 手写 `<button>` + inline style hover | `<Button variant="..." size="...">` | 全部 |
| 手写 `<input>` | `<Input>` | Knowledge, Chat, Skills, Settings |
| 手写 `<textarea>` | `<Textarea>` | Chat, Skills, Knowledge |
| 自制 Modal（SkillsPage/ScheduledTasksPage） | `<Dialog>` | Skills, Scheduler, Chat |
| Mobile 侧栏抽屉 | `<Sheet>` | AppLayout |
| 手写搜索框 | `<Command>` (⌘K 全局搜索) | Header |
| `<Loader2 className="animate-spin">` | `<Skeleton>` 骨架屏 | 全部 Loading 状态 |
| 手写 Tab 导航 | `<Tabs>` | Settings |
| 手写 Toggle 开关 | `<Switch>` | Skills（启用/禁用） |
| 手写文档列表 | `<Table>` | KnowledgeDetail |
| `<select>` | `<Select>` | Skills（type选择）, Scheduler |
| 无 Toast 反馈 | `<Sonner>` toast | 全局操作反馈 |
| 无 Tooltip | `<Tooltip>` | 收起侧栏图标、操作按钮 |
| 手写侧栏 | shadcn `<Sidebar>` | Sidebar 整体 |

### 3.3 复合组件设计

#### `<StatCard>` — 统计卡片
```tsx
// components/composed/stat-card.tsx
interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; isUp: boolean };
  color?: 'primary' | 'info' | 'success' | 'warning';
}
// 基于 <Card> 封装，支持动画计数、趋势箭头
```

#### `<EmptyState>` — 空状态
```tsx
// components/composed/empty-state.tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
// 替代 5 处重复实现 (Chat, Knowledge, Skills, Scheduler)
```

#### `<PageHeader>` — 页面头部
```tsx
// components/composed/page-header.tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}
```

#### `<DataTable>` — 数据表格
```tsx
// components/composed/data-table.tsx
// 基于 shadcn Table，支持排序、分页、空状态
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  searchKey?: string;
  emptyMessage?: string;
}
```

#### `<MessageBubble>` — 聊天气泡
```tsx
// components/composed/message-bubble.tsx
interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceReference[];
  isStreaming?: boolean;
  timestamp?: string;
}
// 支持打字机动画、Markdown 渲染、引用展开
```

---

## 四、动画系统

### 4.1 全局动画常量

```tsx
// lib/animations.ts
import { type Variants } from 'motion/react';

// 页面入场
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const pageTransition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

// 列表 Stagger
export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

// 卡片 Hover
export const cardHover = {
  scale: 1.02,
  transition: { duration: 0.2, ease: 'easeOut' },
};

// 侧栏折叠
export const sidebarVariants: Variants = {
  expanded: { width: 240 },
  collapsed: { width: 64 },
};
```

### 4.2 各场景动画方案

| 场景 | 动画方案 | 实现 |
|------|---------|------|
| **页面切换** | Fade + Slide up(8px) | `<AnimatePresence>` + `pageVariants` |
| **列表加载** | Stagger fade-in | `staggerContainer` + `staggerItem` |
| **卡片 Hover** | Scale(1.02) + Shadow 升级 | `<motion.div whileHover={cardHover}>` |
| **侧栏折叠** | Width + opacity 动画 | `sidebarVariants` + `layout` |
| **Modal/Dialog** | 背景 fade + 内容 scale(0.95→1) | shadcn Dialog 自带，微调 duration |
| **Toast 通知** | Slide from right + fade | Sonner 自带 |
| **搜索面板** | ⌘K Command 弹出 scale | shadcn Command 自带 |
| **Loading** | Skeleton shimmer 动画 | shadcn Skeleton + pulse |
| **按钮点击** | Scale(0.97) spring back | `whileTap={{ scale: 0.97 }}` |
| **数字变化** | Counter 动画 | `motion.span` + `useSpring` |
| **消息流式** | 打字机 + 光标闪烁 | CSS animation |
| **切换开关** | Layout 动画平滑过渡 | `<motion.div layout>` |

---

## 五、各页面重构规格

### 5.1 Sidebar（侧栏）

**现状**: 手写 nav + inline style hover + 手动 mouseEnter/Leave
**目标**: shadcn Sidebar 组件 + Motion 折叠动画

```
结构:
  <SidebarProvider>
    <Sidebar collapsible="icon">          ← shadcn Sidebar
      <SidebarHeader>                     ← Logo: MutiExpert / ME
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map → <SidebarMenuItem> + <SidebarMenuButton>}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>                     ← ThemeToggle + Collapse
      <SidebarRail />                     ← 悬浮触发展开
    </Sidebar>
  </SidebarProvider>

样式要点:
  - Active 状态: bg-sidebar-accent + text-sidebar-primary + left-2px accent bar
  - Hover: bg-sidebar-accent/50 transition-colors 150ms
  - Collapsed: 只显示图标，Tooltip 显示 label
  - Mobile: Sheet 替代自制 drawer，带 backdrop blur
```

### 5.2 Dashboard（仪表盘）

**目标**: 专业数据仪表盘视觉

```
统计卡片 (StatCard):
  - 4 列网格 → Card + icon 左对齐
  - 数字用 motion.span 做计数动画
  - 底部加 mini sparkline 或 trend 箭头
  - Hover: scale(1.02) + shadow-md

AI 使用统计:
  - Card 内含 Progress bar (shadcn Progress)
  - 环形进度图（可选 shadcn Chart / Recharts PieChart）

知识分布热力图:
  - Card 内横向 bar chart
  - 每行: 行业 Badge (industry color) + 进度条 + 数值

活动时间线:
  - 左侧竖线 + 圆点 + 右侧内容
  - stagger 入场动画
  - 时间戳用 text-xs text-muted-foreground
```

### 5.3 Knowledge（知识库）

```
左侧行业分类树:
  - Collapsible + SidebarMenu 风格
  - 每个行业: industry-badge 颜色 + 计数 Badge
  - Active 状态: accent-subtle background

右侧知识库列表:
  - SearchBar (Command 风格的搜索框)
  - 卡片网格: Card + CardHeader(title + Badge) + CardContent(描述 + 统计)
  - Hover: cardHover 动画
  - Empty: EmptyState 组件

知识库详情:
  - PageHeader: 标题 + 行业 Badge + 操作按钮 (Button variants)
  - Tabs: 文档 | 链接 | 文章
  - 文档列表: Table (shadcn) + 操作 DropdownMenu
  - 上传区: 拖拽区域 + 进度条 (Progress)
```

### 5.4 Chat（AI 对话）

```
对话列表:
  - Card 列表 + 最后消息预览
  - 新建对话: Dialog (替代手制 Modal)
  - 知识库选择: Select / Command 多选

对话详情:
  - 消息区: ScrollArea + MessageBubble
  - 用户消息: 右对齐，primary 色背景
  - AI 消息: 左对齐，card 色背景，带 Avatar(Bot)
  - 流式输出: 打字机动画 + 闪烁光标
  - 引用来源: Collapsible + Badge + 链接
  - 输入区: Textarea + 发送 Button
  - Skeleton: 消息加载骨架屏
```

### 5.5 Skills（技能管理）

```
布局:
  - PageHeader: "技能管理" + SearchBar + Button(新建)
  - 卡片网格: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

SkillCard:
  - Card + CardHeader(name + type Badge + Switch)
  - CardContent: 描述/prompt 预览 (line-clamp-2)
  - CardFooter: 操作按钮组 (Button ghost + DropdownMenu)
  - Hover: cardHover

创建/编辑: Dialog
执行: Sheet (从右滑出)
```

### 5.6 Scheduler（定时任务）

```
类似 Skills 布局:
  - TaskCard: Card + 状态 Badge(active/paused/error) + Cron 说明
  - Switch: 启用/禁用
  - 下次执行时间: text-muted-foreground
  - 创建: Dialog + Cron 预设 Select
```

### 5.7 Analytics（数据分析）

```
图表区:
  - shadcn Chart (基于 Recharts) 替代裸 Recharts
  - 统一 chart 主题色为 CSS 变量
  - Card 包裹 + CardHeader(标题 + 时间范围 Select)

洞察列表:
  - Card 列表 + 行业 Badge + 推送 Button
```

### 5.8 Settings（系统管理）

```
布局:
  - Tabs (shadcn) 替代手写 Tab 导航
  - 每个 Tab 内: Card 分组

AI 模型:
  - Card per model + Switch + Input(API Key, type="password")
  - 测试连接 Button

集成:
  - FormField 统一: Label + Input + 说明文字
  - 飞书 Card: 状态 Badge + Config 表单

数据管理:
  - StatCard 网格
  - 操作按钮: Button variant="destructive" (危险操作红色)
  - ConfirmDialog 确认
```

---

## 六、执行计划（分步推进）

### Phase 1: 基础设施（Day 1）

| # | 任务 | 交付物 |
|---|------|--------|
| 1.1 | `npx shadcn@latest init` 初始化 | components.json, globals.css |
| 1.2 | 安装 motion, tailwind-merge, cva | package.json 更新 |
| 1.3 | 创建 `lib/utils.ts` (cn 函数) | cn() 工具 |
| 1.4 | 迁移 CSS 变量到 shadcn 标准命名 | globals.css (保留行业色) |
| 1.5 | 批量安装 shadcn 组件 | components/ui/*.tsx |
| 1.6 | 创建 `lib/animations.ts` | 动画常量 |

### Phase 2: 原子组件替换（Day 2）

| # | 任务 | 影响范围 |
|---|------|---------|
| 2.1 | 所有 `<button>` → `<Button>` | 全部页面 |
| 2.2 | 所有卡片 div → `<Card>` | Dashboard, Knowledge, Skills, Scheduler |
| 2.3 | 所有 `<input>` → `<Input>` | Chat, Skills, Settings |
| 2.4 | 所有手制 Modal → `<Dialog>` | Skills, Scheduler, Chat |
| 2.5 | Loading → `<Skeleton>` | 全部页面 |
| 2.6 | 消除 inline style (style={{ }}) | 全部页面 |

### Phase 3: 布局重构（Day 3）

| # | 任务 | 交付物 |
|---|------|--------|
| 3.1 | Sidebar → shadcn Sidebar | layout/app-sidebar.tsx |
| 3.2 | Mobile Drawer → Sheet | layout/app-sidebar.tsx |
| 3.3 | Header + ⌘K 搜索 → Command | layout/app-header.tsx |
| 3.4 | 提取 PageHeader / PageContainer | composed/page-header.tsx |
| 3.5 | Settings Tab → shadcn Tabs | settings-layout.tsx |

### Phase 4: 复合组件（Day 4）

| # | 任务 | 交付物 |
|---|------|--------|
| 4.1 | EmptyState 统一 | composed/empty-state.tsx |
| 4.2 | StatCard 统一 | composed/stat-card.tsx |
| 4.3 | DataTable 统一 | composed/data-table.tsx |
| 4.4 | MessageBubble 统一 | composed/message-bubble.tsx |
| 4.5 | SkillCard / TaskCard | composed/skill-card.tsx, task-card.tsx |
| 4.6 | IndustryBadge 统一 | composed/industry-badge.tsx |

### Phase 5: 动画注入（Day 5）

| # | 任务 | 效果 |
|---|------|------|
| 5.1 | 页面切换 AnimatePresence | 页面 fade + slide 过渡 |
| 5.2 | 列表 stagger 入场 | 卡片/列表依次出现 |
| 5.3 | Card hover 动画 | scale + shadow 提升 |
| 5.4 | 数字计数动画 | Dashboard 统计数字 |
| 5.5 | Chat 打字机动画 | 流式消息光标闪烁 |
| 5.6 | Toast 通知集成 | 全局操作反馈 |

### Phase 6: 打磨 & 验收（Day 6）

| # | 任务 |
|---|------|
| 6.1 | 暗色模式全面测试 |
| 6.2 | 移动端响应式验证 (375px / 768px / 1280px) |
| 6.3 | Accessibility 检查 (键盘导航、ARIA) |
| 6.4 | 性能检查 (bundle size、首屏加载) |
| 6.5 | `npx tsc -b` 类型检查通过 |
| 6.6 | 清理遗留代码 (旧 CSS 变量、unused imports) |

---

## 七、设计规范速查

### 按钮变体

| 变体 | 用途 | 示例 |
|------|------|------|
| `default` | 主要操作 | 新建、保存、发送 |
| `secondary` | 次要操作 | 取消、返回 |
| `outline` | 边框按钮 | 筛选、导出 |
| `ghost` | 无背景 | 图标按钮、菜单项 |
| `destructive` | 危险操作 | 删除、重置 |
| `link` | 链接样式 | 查看更多 |

### Badge 变体

| 变体 | 用途 |
|------|------|
| `default` | 通用标签 |
| `secondary` | 次要信息 |
| `outline` | 边框标签 |
| `destructive` | 错误/危险 |
| 自定义 industry-* | 行业色标签 |

### 间距规范

| 位置 | 值 |
|------|-----|
| 卡片内边距 | p-4 sm:p-6 |
| 卡片间距 | gap-4 sm:gap-6 |
| 区块间距 | space-y-6 sm:space-y-8 |
| 表单字段间距 | space-y-4 |
| 按钮组间距 | gap-2 |
| 图标与文字 | gap-2 (8px) |

### 阴影使用规范

| 层级 | 场景 |
|------|------|
| 无阴影 | 默认状态的卡片（用 border 代替） |
| shadow-sm | Hover 状态 |
| shadow-md | 浮动元素 (Dropdown, Popover) |
| shadow-lg | Modal / Dialog |

---

## 八、核心约束

1. **不改动 services/ / stores/ / types/ / routes/**  — 只重构视觉层
2. **shadcn 组件生成后可自由修改** — 代码属于项目，不是黑盒依赖
3. **cn() 替代 clsx** — 统一使用 `cn()` (clsx + twMerge)，消除 class 冲突
4. **禁止 inline style** — 所有样式通过 Tailwind class + CSS 变量实现
5. **禁止 onMouseEnter/Leave 管理 hover** — 用 Tailwind `hover:` 前缀
6. **暗色模式必须完整** — 每个组件都要在 dark mode 下验证
7. **行业色系统保留** — 作为 shadcn 标准色板的扩展
8. **保持功能不变** — 重构只改视觉和交互，不改业务逻辑
9. **每个 Phase 完成后 `npx tsc -b` 必须通过**
10. **移动端 (≤640px) 必须可用** — 不能只顾桌面端

---

> **使用方式**: 将本文档作为提示词输入 AI，按 Phase 顺序逐步执行。
> 每个 Phase 可以作为独立对话，携带本文档作为上下文。
