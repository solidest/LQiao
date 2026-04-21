# LQiao / 灵桥 — v1.1 ~ v1.6 验收报告

> 验收日期：2026-04-21
> 验收方式：逐分支 `bun run check`（tsc + vitest）+ 覆盖率 + 关键代码审查

---

## 1. 总览

| 版本 | 分支 | 测试数 | tsc | 覆盖率 | 状态 |
|------|------|--------|-----|--------|------|
| v1.1 MCP 协议客户端 | feat/v1.1-mcp-client | 201 | ✅ | 达标 | ✅ PASS |
| v1.2 通义/DeepSeek/Ollama | （合并在 v1.1） | 含上方 | ✅ | 达标 | ✅ PASS |
| v1.3 Claude Code Skill | feat/v1.3-claude-skill | 242 | ✅ | 达标 | ✅ PASS |
| v1.4 条件分支 + 操作审计 | feat/v1.4-branch-audit | 157 | ✅ | 达标 | ✅ PASS |
| v1.5 工具注册热更新 | feat/v1.5-tool-registry-hotswap | 271 | ✅ | 93.42% / 89.72% | ✅ PASS |
| v1.6 Git 工具增强 | feat/v1.6-git-enhancement | 153 | ✅ | 达标 | ✅ PASS |

**覆盖率基准（v1.5 最全分支）：Lines 93.42% / Branches 89.72%**，均超过 PRD 目标（lines > 85%, branches > 75%）。

---

## 2. 各版本功能验收

### v1.1 — MCP 协议客户端

**核心文件：**
- [src/mcp/client.ts](src/mcp/client.ts) — McpClient，支持并行连接多服务器
- [src/mcp/transports/stdio.ts](src/mcp/transports/stdio.ts) — StdioTransport，JSON-RPC over stdio，默认 env 为空对象
- [src/mcp/transports/sse.ts](src/mcp/transports/sse.ts) — SSETransport，HTTP Server-Sent Events 长连接
- [src/tools/mcp-tool.ts](src/tools/mcp-tool.ts) — McpToolAdapter，MCP 工具转内部 Tool 接口

**验收要点：**
- MCP Client 测试 16 个：连接、并行、断开、request/response
- SSE 传输测试 7 个：连接/超时/自定义 headers/HTTPS/消息收发
- Stdio 传输测试 9 个：进程启动/消息收发/环境安全
- Tool Adapter 测试 8 个：schema 验证/工具转换/执行
- MCP 集成测试 6 个：端到端流程

**代码审查修复：**
- [高] SSE connect timer — endpoint 发现后立即清除，不再等到 `end` 事件（commit `6d03425`）
- [中] SSE end→close 事件序列 — 正常结束时保留 `#messageUrl`，避免 `isConnected` 竞态
- [低] MAX_BUFFER_SIZE 限制防止无界缓冲增长

### v1.2 — 通义/DeepSeek/Ollama 模型

**核心文件：**
- [src/model/dashscope.ts](src/model/dashscope.ts) — 继承 OpenAIModel，baseUrl 指向阿里云 dashscope
- [src/model/deepseek.ts](src/model/deepseek.ts) — 继承 OpenAIModel，baseUrl 指向 deepseek
- [src/model/ollama.ts](src/model/ollama.ts) — 继承 BaseModel，fetch 调用本地 Ollama REST API

**验收要点：**
- DashScope 测试 3 个：生成/带选项/流式
- DeepSeek 测试 3 个：生成/带选项/流式
- Ollama 测试 9 个：生成/流式/空流/自定义 baseUrl

**代码审查修复：**
- [中] Ollama stream `res.body` null 时 yield `{text: '', done: true}`，避免消费者挂起（commit `6d03425`）
- [低] DashScope/DeepSeek 文件重复 — 各仅 ~10 行，继承 OpenAIModel 即可，无需抽象

### v1.3 — Claude Code Skill

**核心文件：**
- [src/core/skill-loader.ts](src/core/skill-loader.ts) — Skill 加载、解析、验证
- [src/core/skill-registry.ts](src/core/skill-registry.ts) — Skill 注册、匹配、查询
- [src/types/skill.ts](src/types/skill.ts) — Skill / SkillConfig 类型定义

**验收要点：**
- skill-loader 测试 13 个：加载/解析/验证/错误处理
- skill-registry 测试 18 个：注册/查询/启用禁用/优先级
- skill 集成测试 10 个：Agent + Skill 端到端流程

### v1.4 — 条件分支 + 操作审计

**核心文件：**
- [src/core/branch-engine.ts](src/core/branch-engine.ts) — Condition / BranchRule / evaluateBranch
- [src/core/react-agent.ts](src/core/react-agent.ts) — ReAct Agent，提取 `#runLoop` 共享循环
- [src/security/audit.ts](src/security/audit.ts) — AuditLog，记录/过滤/统计/持久化

**验收要点：**
- branch-engine 测试 11 个：equals/contains/exists/regex/多规则排序/elseSteps 返回
- audit 测试 12 个：record/过滤/summary/持久化/时间范围/cleanup
- ReactAgent 测试 6 个（含 retry 500ms）

**代码审查修复：**
- [高] elseSteps 在无规则匹配时返回 `rules[0]?.elseSteps ?? []`（commit `2ec1ded`）
- [中] run/runWithBranches 提取 `#runLoop` 消除 ~80 行重复（commit `2ec1ded`）
- [中] saveToFile/loadFromFile 改用 `node:fs/promises`（commit `2ec1ded`）
- [低] audit 测试 `afterEach` 清理临时文件（commit `2ec1ded`）

**待处理：**
- [中] 分支决策通过 prompt 文本注入（3.2）— 依赖 LLM 解释，非框架强制步骤，属设计取舍

### v1.5 — 自定义工具注册 + 运行时热更新

**核心文件：**
- [src/tools/registry.ts](src/tools/registry.ts) — ToolRegistry，支持运行时热更新
- [src/core/agent-hotswap.ts](src/core/agent-hotswap.ts) — Agent 运行时配置热切换

**验收要点：**
- registry-hotswap 测试 10 个：注册/卸载/热更新/事件触发
- agent-hotswap 测试 19 个：工具切换/模型切换/配置生效
- 集成测试 10 个：Skill + Tool 端到端

### v1.6 — Git 工具增强

**核心文件：**
- [src/tools/git-tool.ts](src/tools/git-tool.ts) — GitTool，支持 add/commit/push/log/diff/status

**新增操作：**
| 操作 | 参数 | 返回 |
|------|------|------|
| `log` | `count?`, `file?` | 最近 N 条提交（hash/author/date/message） |
| `diff` | `file?`, `revision?` | 差异文本 + 增删行数统计 |
| `status` | 无 | 已暂存/已修改/未跟踪文件列表 |

**验收要点：**
- git-tool 测试 24 个：add 3 + commit 4 + push 3 + unknown 1 + numeric-key 3 + log 4 + diff 4 + status 2

**代码审查修复：**
- [低] extractArgs numeric-key — 新增 `mapNumericArgs` 将 `{0: 'log', 1: 5}` 映射为 `{count: 5}`（commit `dca6b20`）
- [低] beforeEach 改用 `mockReset()` 清除 `mockResolvedValue` 泄漏（commit `dca6b20`）

---

## 3. 代码审查修复汇总

| # | 问题 | 严重程度 | 分支 | 修复提交 | 状态 |
|---|------|---------|------|---------|------|
| 1.1 | SSE timer 切断长连接 | 高 | v1.1 | `6d03425` | ✅ 已修复 |
| 1.3 | Ollama stream body null | 中 | v1.1 | `6d03425` | ✅ 已修复 |
| 1.6 | DashScope/DeepSeek 重复文件 | 低 | v1.1 | 维持现状 | ⏭️ 跳过（代码极简） |
| 2.3 | extractArgs numeric-key 不完整 | 低 | v1.6 | `dca6b20` | ✅ 已修复 |
| 2.4 | 测试 mock shared state | 低 | v1.6 | `dca6b20` | ✅ 已修复 |
| 3.1 | elseSteps 从未返回 | 高 | v1.4 | `2ec1ded` | ✅ 已修复 |
| 3.2 | 分支注入脆弱性 | 中 | v1.4 | 设计取舍 | ⏭️ 非 bug |
| 3.3 | run/runWithBranches 重复 | 中 | v1.4 | `2ec1ded` | ✅ 已修复 |
| 3.4 | saveToFile async/sync 不一致 | 中 | v1.4 | `2ec1ded` | ✅ 已修复 |
| 3.6 | audit 测试临时文件 | 低 | v1.4 | `2ec1ded` | ✅ 已修复 |

---

## 4. 覆盖率详情（v1.5 分支，代码最全）

| 模块 | Lines | Branches | Functions |
|------|-------|----------|-----------|
| core/ | 95.28% | 92.65% | 98.14% |
| errors/ | 100% | 100% | 100% |
| logger/ | 100% | 97.05% | 100% |
| mcp/ | 100% | 96.77% | 100% |
| mcp/transports | 78.54% | 84.48% | 93.75% |
| model/ | 99.61% | 84.88% | 100% |
| security/ | 97.05% | 97.72% | 80% |
| tools/ | 90.40% | 82.40% | 100% |
| utils/ | 94.64% | 88.00% | 100% |
| **总计** | **93.42%** | **89.72%** | **96.48%** |

---

## 5. 分支状态

```
feat/v1.1-mcp-client          → ✅ 最新提交 6d03425
feat/v1.3-claude-skill        → ✅ 最新提交 2201471
feat/v1.4-branch-audit        → ✅ 最新提交 2ec1ded
feat/v1.5-tool-registry-hotswap → ✅ 最新提交 2201471
feat/v1.6-git-enhancement     → ✅ 最新提交 dca6b20
```

全部 6 个分支均通过 `bun run check`（tsc + vitest），零失败测试。
