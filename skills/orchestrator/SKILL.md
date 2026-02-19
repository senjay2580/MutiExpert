# Skill 协同编排器

> You say WHAT, AI decides HOW.
> 理解意图 → 判断复杂度 → 分配角色 → 匹配 Skill → 编排执行

## 触发条件

- 输入 `/skill-orchestrator`
- 需求涉及 2 个以上步骤或领域
- 用户明确要求「规划」「编排」「plan」
- 需求模糊，需要先拆解再执行

---

## 核心机制：模式 → 复杂度 → 工作流 → 角色链

### Step 0: 模式判断

```
用户输入
    │
    ▼
┌─ 模式检测 ──────────────────────────────┐
│ 用户说了"TDD"/"测试驱动"/"--tdd"？       │
│   是 → TDD 模式（先写测试再写代码）      │
│   否 → 普通模式（默认，直接编码）         │
└──────────────────────────────────────────┘
```

**普通模式**（默认）：编码优先，完成后补测试验证
**TDD 模式**（用户指定）：测试优先，Red-Green-Refactor 严格循环

### Step 1: 复杂度判断

```
    │
    ▼
┌─ 复杂度判断（5 个信号）─────────────────┐
│ 信号1: 涉及几个文件？  1个=低 3+=高      │
│ 信号2: 跨前后端？      单端=低 全栈=高   │
│ 信号3: 需求是否明确？  明确=低 模糊=高   │
│ 信号4: 是否涉及新技术？ 否=低 是=高      │
│ 信号5: 是否影响已有功能？ 否=低 是=高    │
└──────────────────────────────────────────┘
```

### Step 2: 工作流分配

**普通模式**：
```
  低(0-1高) → 快速流 → @frontend-dev/@backend-dev → @tester
  中(2-3高) → 标准流 → @researcher → @frontend-dev/@backend-dev → @reviewer → @tester
  高(4-5高) → 完整流 → @researcher → @architect → @designer
                        → (@frontend-dev + @backend-dev 并行) → (@reviewer + @tester 并行) → @writer
```

**TDD 模式**（测试前置，编码后置）：
```
  低(0-1高) → TDD快速流 → @tester(写测试🔴) → @frontend-dev/@backend-dev(最小实现🟢) → @tester(验证+重构🔵)
  中(2-3高) → TDD标准流 → @researcher → @tester(写测试🔴) → @frontend-dev/@backend-dev(最小实现🟢) → @reviewer → @tester(验证🔵)
  高(4-5高) → TDD完整流 → @researcher → @architect(定测试策略) → @tester(写测试🔴)
                           → (@frontend-dev + @backend-dev 并行)(最小实现🟢) → (@reviewer + @tester 并行)(验证🔵) → @writer
```

### 附加工作流（按需触发）

| 工作流 | 角色链 | 触发条件 |
|--------|--------|---------|
| 部署流 | @devops | 用户说「部署/上线/发布」 |
| 文档流 | @researcher → @writer | 用户说「写文档/汇报/周报」 |
| 分享流 | @messenger | 用户说「发飞书/分享/截图」 |
| 变更记录流 | @writer(`/change-log`) | 用户说「记录修改/变更日志」 |

---

## 角色说明

> 每个角色的完整技能包见 `skill-orchestrator:references:skill-registry`

| 角色 | 职责 | 推荐模型 |
|------|------|---------|
| @researcher | 需求对齐、技术调研、信息搜索 | haiku |
| @architect | 架构设计、模块拆分、方案评审、画图 | opus |
| @designer | UI/UX、视觉、主题、前端界面 | sonnet |
| @frontend-dev | 前端页面编码、组件开发 | sonnet |
| @backend-dev | 后端接口编码、Service实现 | sonnet |
| @toolsmith | Skill/MCP/插件开发 | opus |
| @reviewer | Code Review、规范检查、安全审计 | opus |
| @tester | 自动化测试、浏览器验证 | haiku |
| @devops | 部署、CI/CD、服务器操作 | sonnet |
| @writer | 文档撰写、汇报生成 | sonnet |
| @messenger | 飞书消息、截图分享 | haiku |

---

## 自动触发规则

> 根据任务特征自动激活角色，无需用户指定。

| 触发条件 | 自动激活角色 | 动作 |
|---------|-------------|------|
| 需求模糊/有歧义 | @researcher | 需求对齐，列出待确认项 |
| 涉及新技术/未用过的库 | @researcher | `/web-search-plus` 技术调研 |
| 修改 API/数据模型 | @architect | 影响分析（上下游检查） |
| 跨前后端全栈 | @architect | 架构设计 + 依赖排序 |
| 多方案可选 | @architect | 方案评审（列优劣对比） |
| 涉及页面/UI | @designer | 布局+组件+样式方案 |
| 仅代码修复 | @frontend-dev/@backend-dev | 快速流，跳过设计阶段 |
| 代码完成 | @reviewer + @tester | 并行质量门 |
| 需要上线 | @devops | 部署流程 |

---

## Skill 来源与加载

### 来源优先级

```
1. 项目命令:  {项目根目录}/.claude/commands/*    ← 最高优先，同名覆盖全局
2. 全局命令:  C:\Users\33813\.claude\commands\*
3. 在线搜索:  /web-search-plus → GitHub
```

### 懒加载（三层）

```
发现层: 只读 skill-registry.md 的角色+触发词（零成本）
匹配层: 关键词命中后，读对应 Skill 的 SKILL.md
注入层: 执行时才加载 references/ 和 scripts/
```

### 项目级 Skill 加载规则（软连接模式）

全局注册表为只读，不可修改。加载分两种情况：

```
全局 Skill（注册表标记「全局」）:
  1. 先查项目 .claude/commands/ 下是否有同名 skill
  2. 有 → 从项目路径读取（软连接覆盖）
  3. 没有 → 从全局读取（默认行为）
  4. 全局也没有 → 在线搜索

项目级 Skill（注册表标记「项目级」，如 /debug、/deploy）:
  1. 直接从当前项目 .claude/commands/ 读取
  2. 项目下不存在 → 不回退全局，提示用户当前项目缺少该 skill
```

### 缺失 Skill 处理（全局/扩展）

```
子任务无匹配 Skill 时:
  1. @researcher 调用 /search-skill 或 /web-search-plus 搜索
  2. 找到 → 提示用户是否安装到全局目录
  3. 未找到 → 标记为「手动执行」，由 @frontend-dev/@backend-dev 直接完成
```

---

## 执行编排

### 拆解原则

- 每个子任务只做一件事（单一职责）
- 粒度：一个角色的一个 Skill 能独立完成
- 每个子任务有可验证的交付物

### 依赖排序

```
T(n) 的输入是 T(m) 的输出 → 串行
T(n) 修改的文件是 T(m) 要读的 → 串行
无数据/文件交叉 → 并行（用 subagent）
```

### 并行质量门（标准流+完整流）

```
                    ┌→ @reviewer（Code Review）──┐
执行完成 → 分叉 ──┤                             ├→ 汇合 → 通过
                    └→ @tester（功能测试）────────┘
                                                      ↓ 失败
                                                 反馈 @frontend-dev/@backend-dev 修复
```

### 计划输出模板

```markdown
## 执行计划

复杂度: {低/中/高} → {快速流/标准流/完整流}

| # | 子任务 | 角色 | Skill | 交付物 | 依赖 |
|---|--------|------|-------|--------|------|
| T1 | {描述} | @researcher | /web-search-plus | {结果} | 无 |
| T2 | {描述} | @backend-dev | /debug | {文件} | T1 |
| T3 | {描述} | @reviewer | - | Review通过 | T2 |

执行顺序:
  Step 1 (并行): T1, T2
  Step 2 (串行): T3 ← 依赖 T2
  Step 3 (并行质量门): @reviewer + @tester
```

---

## 参数模式

### `/skill-orchestrator` — 自动编排（普通模式）

判断复杂度 → 选工作流 → 分配角色 → 匹配 Skill → 输出计划 → 执行。
编码优先，完成后补测试验证。

### `/skill-orchestrator --tdd` — TDD 模式

用户明确指定 TDD 时激活。也可通过自然语言触发（"用TDD开发"、"测试驱动"）。
测试优先，严格 Red-Green-Refactor：
1. @tester 先写失败测试（🔴 Red）
2. @frontend-dev/@backend-dev 写最小实现让测试通过（🟢 Green）
3. @tester 验证全绿后重构（🔵 Refactor）
TDD 模式下自动加载 `/test-driven-development` + `/tdd-orchestrator`。

### `/skill-orchestrator update` — 注册表刷新

```
1. 扫描三层来源目录（排除 skill-orchestrator 自身）
2. 读取每个 Skill 的 SKILL.md 提取能力描述
3. 按角色触发词自动归类（无法归类 → @backend-dev）
4. 与 skill-registry.md 对比: 新增追加 / 已删移除 / 已存在不覆盖
5. 输出变更摘要
```

---

## 约束

- 快速流可跳过 Plan，标准流和完整流必须先规划再执行
- 不虚构 Skill，只匹配 Registry 中存在的
- 项目级 Skill 同名时覆盖全局，不混用
- 计划表必须包含「角色」和「交付物」列
- 并行质量门：@reviewer 和 @tester 都通过才算完成
- 用户没说「优化」时，默认按 MVP 标准执行（只做必要的，不过度设计）
