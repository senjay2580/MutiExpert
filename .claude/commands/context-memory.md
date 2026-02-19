---
name: context-memory
description: 生成上下文记忆文档，方便在新对话中快速恢复工作状态
model: haiku
---

# Context Memory Generator

Generate a structured context memory document that captures the current conversation's key information, making it easy to resume work in a new conversation.

## Execution Steps

### Step 1: Read Knowledge Graph
Read all entities and relations from the knowledge graph using the memory tool.

### Step 2: Analyze Current Conversation
Analyze the current conversation to extract:
- User's main goals and requirements
- Completed operations and their status
- Current work state and context
- Important decisions and reasoning
- User preferences and working style
- Next steps or pending tasks

### Step 3: Generate Structured Document

Create a well-structured memory document with the following sections:

```markdown
# 对话历史关键信息总结

生成时间：[Current timestamp]

## 1. 用户的主要目标和需求

[List the user's core objectives and what they want to accomplish]

### 第一个需求：[Requirement name]
- **目标**：[Goal description]
- **核心功能**：[Key features]
- **特点**：[Characteristics]

### 第二个需求：[Requirement name]
- **目标**：[Goal description]
- **核心流程**：[Process steps]

[Continue for all major requirements...]

## 2. 已完成的重要操作

✅ **[Operation 1]** - [Brief description]
- 文件：[File path if applicable]
- 包含：[Key features or components]

✅ **[Operation 2]** - [Brief description]
- 文件：[File path if applicable]
- 包含：[Key features or components]

⏳ **[Operation 3]** - [In progress description]
- 状态：[Current status]
- 下一步：[Next steps]

## 3. 当前工作状态和上下文

**当前状态**：[What is currently being worked on]

**项目环境**：
- 项目路径：[Project path]
- 技术栈：[Technology stack]
- 已有 skills：[List of existing skills]

**下一步**：[What needs to be done next]

## 4. 重要决策和原因

[List key decisions made during the conversation]
- **决策**：[Decision description]
- **原因**：[Reasoning behind the decision]

## 5. 用户偏好和工作方式

[List user preferences observed during the conversation]
- [Preference 1]
- [Preference 2]
- [Preference 3]

---

**使用说明**：
1. 复制上述内容
2. 在新对话开始时粘贴
3. Claude 将快速理解之前的工作状态并继续
```

### Step 4: Format and Output

Present the document in a clean, copyable format with:
- Clear section headers
- Status indicators (✅ ⏳ ❌)
- Proper indentation and structure
- Timestamp for reference
- Easy-to-read formatting

### Step 5: Provide Usage Instructions

After generating the document, provide clear instructions:

```
📋 **上下文记忆文档已生成**

**如何使用**：
1. 复制上面的整个文档
2. 在新对话中，直接粘贴这个文档
3. 告诉 Claude："这是我们之前对话的上下文，请继续"

**提示**：
- 这个文档包含了所有关键信息
- 可以随时更新和补充
- 建议在对话结束前生成一次
```

## Quality Standards

- ✅ **完整性**：包含所有关键信息，不遗漏重要内容
- ✅ **结构化**：清晰的层次结构，易于阅读
- ✅ **可复制**：格式适合直接复制粘贴
- ✅ **时效性**：包含时间戳，方便追溯
- ✅ **精准性**：准确反映当前状态，不含过时信息
- ✅ **实用性**：新对话能快速理解并继续工作

## Output Format

The output should be a complete, self-contained markdown document that:
1. Starts with a clear title and timestamp
2. Uses consistent formatting (headers, lists, status icons)
3. Groups related information logically
4. Includes all necessary context for resuming work
5. Ends with clear usage instructions

## Example Output Structure

```markdown
# 对话历史关键信息总结

生成时间：2024-01-15 14:30:00

## 1. 用户的主要目标和需求

用户需要创建三个高级 CLI skills：

### 第一个需求：项目定制初始化 skill
- **目标**：批量更新 `.claude/commands/` 下所有 skills 中的项目特定信息
- **核心功能**：交互式询问项目信息，自动替换所有 skills 中的旧信息
- **特点**：包含预览确认、自动备份、详细报告等安全机制

### 第二个需求：需求对齐 skill
- **目标**：处理用户的模糊需求，精确定位代码，优化需求描述
- **核心流程**：
  1. 接收模糊需求输入
  2. 智能定位相关代码（精确到行号）
  3. 系统化分析需求（5W2H方法）
  4. 生成结构化输出和理解复述

## 2. 已完成的重要操作

✅ **项目定制初始化 skill** - 已成功创建
- 文件：`.claude/commands/init-project.md`
- 包含自动扫描、交互式询问、预览确认、批量替换、生成报告等功能

✅ **需求对齐 skill** - 已成功创建
- 文件：`.claude/commands/requirement-alignment.md`
- 包含智能代码定位、5W2H需求分析、结构化输出等功能

✅ **技术方案评估 skill** - 已成功创建
- 文件：`.claude/commands/solution-evaluator.md`
- 包含行业最佳实践分析、方案评判、优化方案提出等功能

## 3. 当前工作状态和上下文

**当前状态**：用户正在学习 Claude Code 的记忆管理功能

**项目环境**：
- 项目路径：`d:\Desktop\MySystem\4.门店管理系统\store_manager\`
- 技术栈：Spring Boot + JPA
- 已有 skills：keybindings-help、debug-miniapp、commit、business-flow-analyzer、init-project、requirement-alignment、solution-evaluator 等

**下一步**：测试新创建的 skills，验证其功能和输出质量

## 4. 重要决策和原因

- **决策**：solution-evaluator skill 使用 opus 模型
- **原因**：需要深度推理能力来分析技术方案和展示思维链路

- **决策**：所有 skills 都包含详细的方法论基础
- **原因**：用户重视最佳实践和系统化方法

## 5. 用户偏好和工作方式

- 喜欢创建高级、系统化的 CLI skills
- 重视方法论和最佳实践
- 需要详细的文档和结构化输出
- 关注技术方案的深度分析和推导过程
- 偏好中文交流和文档

---

**使用说明**：
1. 复制上述内容
2. 在新对话开始时粘贴
3. Claude 将快速理解之前的工作状态并继续
```

## Notes

- This skill should be invoked when the user wants to save the current conversation context
- The generated document should be comprehensive but concise
- Focus on actionable information that helps resume work quickly
- Use the knowledge graph as the primary source of truth
- Supplement with conversation analysis for recent updates
- Always include a timestamp for reference
- Make the output easy to copy and paste
