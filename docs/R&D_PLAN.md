# LQiao / 灵桥 — 研发计划

> 版本：v1.0
> 日期：2026-04-21
> 状态：草案

---

## 1. 总览

### 1.1 项目信息

| 项目 | 内容 |
|-----|------|
| 产品名称 | LQiao / 灵桥 |
| 产品形态 | TypeScript npm 包 |
| 目标版本 | v1.0.0（MVP） |
| 预计周期 | 8 周 |
| 建议团队 | 2 名全栈开发者 |

### 1.2 阶段划分

| 阶段 | 周期 | 目标 |
|-----|------|------|
| Phase 0 | 第 1 周 | 项目骨架、工程化基建、事件总线基础 |
| Phase 1 | 第 2 周 | 模型层基础 + 沙箱基础 + 工具接口定义 |
| Phase 2 | 第 3-4 周 | 完整模型适配 + 工具实现 + Agent 主类 + ReAct 循环 |
| Phase 3 | 第 5 周 | CodeAgent + 安全层增强 + 日志系统 |
| Phase 4 | 第 6 周 | API 整合 + 事件钩子 + 类型完善 + 文档 |
| Phase 5 | 第 7-8 周 | 测试覆盖 + 发布准备 |

### 1.3 模块责任矩阵（2 人团队）

| 开发者 | 主要模块 | 协同模块 |
|-------|---------|---------|
| Dev A（后端向） | 模型层、安全层、事件系统 | 工具层 Git 工具、测试 |
| Dev B（前端向） | 工具层、智能体层、API 设计 | 文档、类型定义、构建 |

### 1.4 沙箱设计原则

CodeAgent 与 ReAct Agent 共用**同一套沙箱实现**（`src/security/sandbox.ts`），避免维护两套隔离逻辑：

```
Sandbox
├── 文件沙箱：路径白名单/黑名单限制，适用于所有工具
└── 代码沙箱：VM 隔离 + 网络禁用，专用于 CodeAgent
```

---

## 2. Phase 0：项目骨架与工程化基建（第 1 周）

### 2.1 目标

搭建完整的项目工程结构，**提前定义事件总线**（事件驱动架构要求），确保后续模块可通过事件解耦。

### 2.2 任务清单

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 0.1 | 初始化项目骨架 | `package.json`、`tsconfig.json`、目录结构 | 可编译、类型检查通过 | 0.5d |
| 0.2 | 配置构建工具 | Rollup/esbuild 配置、ESM + CJS 双输出 | 构建产物包含 `.js` + `.d.ts` | 1d |
| 0.3 | 配置测试框架 | Vitest 配置、首个测试用例通过 | `npm test` 可执行 | 0.5d |
| 0.4 | 配置代码规范 | ESLint + Prettier | `npm run lint` 无报错 | 0.5d |
| 0.5 | 配置 CI | GitHub Actions（lint + test + build） | PR 触发自动检查 | 0.5d |
| 0.6 | 定义核心类型 | `src/types/` 下的公共类型定义 | 覆盖 AgentConfig、Tool、Event、Error 等 | 1d |
| 0.7 | **事件总线基础实现** | `src/core/event-bus.ts` | `on()` / `off()` / `emit()` / `once()` 可用，支持通配符 | 1.5d |

### 2.3 事件总线接口定义

```typescript
interface EventBus {
  on(event: string, handler: Handler): void;
  off(event: string, handler: Handler): void;
  emit(event: string, data?: unknown): void;
  once(event: string, handler: Handler): void;
}

type AgentEvent = 'beforeRun' | 'afterRun' | 'onStep' | 'onToolCall' | 'onToolResult' | 'onError';
```

### 2.4 目录结构

```
lqiao/
├── src/
│   ├── index.ts                 # 主入口
│   ├── types/                   # 公共类型定义
│   │   ├── agent.ts             # Agent 相关类型
│   │   ├── tool.ts              # Tool 相关类型
│   │   ├── model.ts             # Model 相关类型
│   │   ├── event.ts             # Event 相关类型
│   │   └── error.ts             # 错误类型定义
│   ├── core/                    # 核心引擎
│   │   ├── agent.ts             # Agent 主类
│   │   ├── react-agent.ts       # ReAct Agent 实现
│   │   ├── code-agent.ts        # CodeAgent 实现
│   │   └── event-bus.ts         # 事件总线（Phase 0 完成）
│   ├── model/                   # 模型层
│   │   ├── base.ts              # Model 基类
│   │   ├── openai.ts            # OpenAI/GPT 适配器
│   │   ├── anthropic.ts         # Anthropic/Claude 适配器
│   │   └── registry.ts          # 模型注册表
│   ├── tools/                   # 工具层
│   │   ├── base.ts              # Tool 基类
│   │   ├── git-tool.ts          # Git 工具
│   │   ├── file-tool.ts         # 文件工具
│   │   └── registry.ts          # 工具注册表
│   ├── security/                # 安全层
│   │   ├── sandbox.ts           # 沙箱隔离（Phase 1 基础）
│   │   ├── permissions.ts       # 权限控制（Phase 3 增强）
│   │   └── audit.ts             # 操作审计（Phase 3）
│   ├── errors/                  # 错误体系
│   │   ├── base.ts              # 基础错误类
│   │   ├── model-error.ts       # 模型错误
│   │   ├── tool-error.ts        # 工具错误
│   │   ├── sandbox-error.ts     # 沙箱错误
│   │   └── retry.ts             # 重试策略
│   ├── logger/                  # 日志系统
│   │   ├── logger.ts            # 结构化日志
│   │   └── profiler.ts          # 性能指标记录
│   └── utils/                   # 工具函数
│       ├── retry.ts             # 通用重试
│       └── format.ts            # 格式化
├── tests/
│   ├── unit/                    # 单元测试
│   ├── integration/             # 集成测试
│   └── fixtures/                # 测试数据
├── docs/                        # 文档
│   ├── api/                     # API 文档
│   └── architecture.md          # 架构设计文档
├── package.json
├── tsconfig.json
├── rollup.config.ts
└── vitest.config.ts
```

---

## 3. Phase 1：模型层基础 + 沙箱基础 + 工具接口定义（第 2 周）

### 3.1 目标

完成模型层骨架、沙箱基础能力（为 Phase 2 CodeAgent 提供隔离环境）、工具基类与接口定义。

### 3.2 模型层任务

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 1.1 | Model 基类 | `src/model/base.ts` | 定义 `generate()`、`stream()` 抽象方法 | 1d |
| 1.2 | 模型注册表 | `src/model/registry.ts` | 通过 `model: 'gpt-4'` 字符串自动匹配 | 0.5d |
| 1.3 | 模型层单测骨架 | `tests/unit/model/` | 基类与注册表有基础测试 | 0.5d |

### 3.3 沙箱基础任务（前移）

> **说明：** 沙箱基础能力前移至此 Phase，与工具层/模型层并行开发，确保 Phase 2 的 CodeAgent 和后续 ReAct Agent 可在有沙箱保护的环境中运行。

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 1.4 | 文件沙箱 | `src/security/sandbox.ts` | 路径白名单/黑名单限制，阻止访问工作目录外文件 | 1.5d |
| 1.5 | 代码沙箱基础 | `src/security/sandbox.ts` | 基于 Node.js `vm` 模块隔离，禁用 `require`/网络访问 | 1d |
| 1.6 | 沙箱单测 | `tests/unit/security/sandbox.test.ts` | 验证越界路径/代码注入均被拦截 | 1d |

### 3.4 工具层任务

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 1.7 | Tool 基类 | `src/tools/base.ts` | 定义 `execute()` 抽象方法、参数校验 | 0.5d |
| 1.8 | 工具接口标准化 | `src/tools/` | 统一输入输出格式，适配 MCP schema | 1d |
| 1.9 | 工具注册表 | `src/tools/registry.ts` | Agent 可通过 `tools: [...]` 传入 | 0.5d |

### 3.5 交付物清单

- 模型层：基类 + 注册表（暂不接真实 API，可 mock 调用）
- 沙箱：文件路径限制 + VM 代码隔离（可独立运行）
- 工具层：Tool 基类 + 注册表 + 标准化接口

---

## 4. Phase 2：完整模型适配 + 工具实现 + Agent 主类 + ReAct 循环（第 3-4 周）

### 4.1 目标

接入真实模型 API、完成内置工具、实现 ReAct Agent 与 Agent 主类。本阶段可与 Phase 1 部分并行（Agent 主类骨架不依赖模型完成）。

### 4.2 模型适配器任务

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 2.1 | OpenAI 适配器 | `src/model/openai.ts` | 支持 GPT-3.5/4/4o，含流式输出、token 计数、错误处理 | 2d |
| 2.2 | Claude 适配器 | `src/model/anthropic.ts` | 支持 Claude 3.x，含流式输出、token 计数、错误处理 | 2d |
| 2.3 | 模型层集成测试 | `tests/integration/model.test.ts` | 真实 API 调用可用，mock 兜底 | 1d |

### 4.3 工具实现任务

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 2.4 | 文件工具 | `src/tools/file-tool.ts` | 读/写/删，集成沙箱路径校验 | 1.5d |
| 2.5 | Git 工具 | `src/tools/git-tool.ts` | add/commit/push，基于 `simple-git`，跨平台测试 | 2d |
| 2.6 | 工具层单测 | `tests/unit/tools/` | 覆盖率 > 80%，Git 操作需 mock | 1d |

### 4.4 Agent 主类 + ReAct 循环任务

> **并行启动：** 任务 2.9（Agent 主类骨架）可在 Phase 1 末期提前开始，不依赖模型适配器完成。

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 2.7 | ReAct 推理循环 | `src/core/react-agent.ts` | Thought → Action → Observation 循环，含 prompt 模板、结果解析 | 3d |
| 2.8 | Prompt 模板工程 | `src/core/` 内嵌模板 | 系统提示词 + ReAct 格式指令，支持多模型模板差异 | 1d |
| 2.9 | Agent 主类 | `src/core/agent.ts` | 聚合模型、工具、安全、事件，`run()` / `stream()` 入口 | 2d |
| 2.10 | 异常重试 | `src/errors/retry.ts` | 指数退避重试，可配置最大次数，区分可重试/不可重试错误 | 1d |
| 2.11 | ReAct 集成测试 | `tests/integration/react-agent.test.ts` | 端到端跑通 3 步骤以上任务（含 mock 模型） | 1.5d |

**ReAct 循环伪代码：**

```
loop (maxSteps):
  1. 构造 prompt（系统提示 + 历史 + 任务）
  2. 调用模型 → 解析 Thought / Action / Observation
  3. 若 Action 存在 → 调用对应工具 → 经沙箱校验 → 记录结果
  4. 若模型输出 Final Answer → 返回结果，结束
  5. 若达到 maxSteps → 抛出 MAX_STEPS 错误
```

### 4.5 交付物清单

- 可调用真实 GPT / Claude 模型
- 文件工具（读/写/删）+ Git 工具（add/commit/push）可正常工作
- ReAct Agent 可自主规划并执行多步骤任务
- `agent.run()` / `agent.stream()` 可正常调用
- 异常重试机制生效

---

## 5. Phase 3：CodeAgent + 安全层增强 + 日志系统（第 5 周）

### 5.1 目标

完成 CodeAgent、权限控制增强、操作审计、结构化日志。沙箱基础已在 Phase 1 完成，本阶段做增强与集成。

### 5.2 CodeAgent 任务

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 3.1 | 代码解析 | `src/core/code-agent.ts` | 从 LLM 响应中提取 code block（支持多种标记格式） | 1d |
| 3.2 | 代码执行引擎 | `src/core/code-agent.ts` | 复用 Phase 1 沙箱，支持 TS/JS 动态执行，执行超时控制 | 1.5d |
| 3.3 | CodeAgent 集成测试 | `tests/integration/code-agent.test.ts` | 执行简单代码片段并获取结果，超时/错误均正确处理 | 1d |

### 5.3 安全层增强任务

> **说明：** Phase 1 已完成沙箱基础（路径限制 + VM 隔离），本阶段做权限控制与审计，避免全堆在此阶段导致工时紧张。

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 3.4 | 权限控制 | `src/security/permissions.ts` | 可配置禁止操作列表（如禁止 rm -rf、禁止 push），支持规则组合 | 2d |
| 3.5 | 操作审计 | `src/security/audit.ts` | 记录每次工具调用的操作日志，支持导出 JSON | 1d |
| 3.6 | 安全层集成测试 | `tests/integration/security.test.ts` | 验证权限拦截、审计日志完整性 | 1d |

### 5.4 日志系统任务

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 3.7 | 结构化日志 | `src/logger/logger.ts` | JSON 格式，包含时间戳/层级/事件类型，可输出到文件 | 1d |
| 3.8 | 调试模式 | `logger.verbose()` | 输出完整的 ReAct 推理链路 | 0.5d |
| 3.9 | 性能指标 | `src/logger/profiler.ts` | 记录工具调用耗时、模型响应时间 | 0.5d |

### 5.5 交付物清单

- CodeAgent 可解析并执行 LLM 生成的代码（沙箱隔离 + 超时控制）
- 权限控制可拦截高危操作
- 操作审计日志可记录并导出
- 结构化日志可输出 JSON，verbose 模式可查看完整推理链路

---

## 6. Phase 4：API 整合 + 事件钩子 + 类型完善 + 文档（第 6 周）

### 6.1 目标

整合所有模块，完善事件钩子系统与 TypeScript 类型定义，编写开发文档。

### 6.2 任务清单

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 4.1 | API 整合与走查 | `src/index.ts` | 所有模块导出正确，无循环依赖 | 1d |
| 4.2 | 事件钩子完善 | Agent 主类集成事件总线 | beforeRun / afterRun / onToolCall / onError / 自定义事件可用 | 1.5d |
| 4.3 | 类型定义完善 | 全量 `.d.ts` | IDE 智能提示完整，无 `any` 逃逸 | 1.5d |
| 4.4 | 错误体系整理 | `src/errors/` | 所有错误类型分类清晰，有明确 type 字段 | 0.5d |
| 4.5 | 错误处理示例 | `agent.run().catch()` | 支持 error.type 判断 + fallback 模型切换 | 0.5d |
| 4.6 | 配置管理 | Agent 构造函数 | 支持环境变量注入、运行时参数修改（`agent.switchModel()`） | 1d |
| 4.7 | 编写 README | `README.md` | 快速入门、API 参考、示例代码 | 2d |
| 4.8 | 编写 API 文档 | `docs/api/` | 每个公开类和方法都有文档说明 | 1.5d |
| 4.9 | 编写架构设计文档 | `docs/architecture.md` | 分层架构图、模块依赖关系、设计决策说明 | 1d |
| 4.10 | 编写贡献者指南 | `CONTRIBUTING.md` | 本地开发流程、PR 规范、测试要求 | 0.5d |
| 4.11 | 编写变更日志模板 | `CHANGELOG.md` | 按版本记录变更，包含 Breaking Changes | 0.5d |

---

## 7. Phase 5：测试覆盖 + 发布准备（第 7-8 周）

### 7.1 目标

完成全量测试覆盖，确保质量达标，准备 npm 发布。

### 7.2 任务清单

| # | 任务 | 产出物 | 验收标准 | 工时 |
|---|------|-------|---------|------|
| 5.1 | 补充单元测试 | `tests/unit/` | 行覆盖率 > 85%，分支覆盖率 > 75% | 3d |
| 5.2 | 集成测试覆盖 | `tests/integration/` | 覆盖完整任务流程（模型 → Agent → 工具 → 结果），含安全场景 | 2d |
| 5.3 | 性能基准测试 | `tests/benchmark/` | 冷启动 < 100ms，打包体积 < 50KB gzip | 1d |
| 5.4 | 打包体积分析 | bundle-analyzer | 确认各模块占比，无意外引入 | 0.5d |
| 5.5 | npm 发布准备 | `package.json`、CHANGELOG | 版本、描述、入口字段正确，CHANGELOG 填写 | 1d |
| 5.6 | 发布 npm | `npm publish` | 包可安装、可导入、示例可运行 | 0.5d |

### 7.3 验收标准汇总

| 指标 | 目标 | 验证方式 |
|-----|------|---------|
| 单元测试覆盖率 | 行 > 85%，分支 > 75% | `npm run test -- --coverage` |
| 冷启动时间 | < 100ms | 基准测试脚本 |
| 打包体积 | < 50KB gzip | `npm run build && gzip -c dist/index.js \| wc -c` |
| ESM + CJS 双输出 | 两个入口均可正常导入 | `node --input-type=module` 和 `node -e` |
| TypeScript 类型 | 无 `any` 类型逃逸 | `tsc --noEmit --strict` |

---

## 8. 风险与应对

### 8.1 外部风险

| 风险 | 影响 | 概率 | 应对措施 |
|-----|------|------|---------|
| 模型 API 限流 | 模型调用失败 | 中 | 指数退避重试 + 请求队列 |
| 生态竞争 | LangChain 推出 TS 原生版本 | 中 | 聚焦轻量与嵌入性差异化优势 |

### 8.2 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|-----|------|------|---------|
| ReAct prompt 调优超预期 | 延期 | 高 | 预留 prompt 调试缓冲时间（Phase 2 额外 0.5d） |
| CodeAgent 执行安全问题 | 沙箱逃逸 | 高 | MVP 阶段禁用网络访问，仅允许纯计算；v2 引入容器化 |
| Git 操作跨平台差异 | 兼容性 bug | 中 | 基于 `simple-git`（已处理跨平台），重点测试 Windows |
| 模型适配器对接耗时 | 延期 | 中 | Phase 2 预留 4d，先用 mock 模型调通 Agent 逻辑，再接真实 API |

### 8.3 管理风险

| 风险 | 影响 | 概率 | 应对措施 |
|-----|------|------|---------|
| Phase 依赖链串行导致延期 | 后续 Phase 顺延 | 中 | Agent 主类骨架、配置解析等任务提前启动，与 Phase 1 并行；Phase 5 分散为 2 周 |
| 2 人团队并行开发冲突 | 代码冲突 | 中 | 明确模块边界，每日合并 main，Phase 1 按文件分配 |

---

## 9. 需求覆盖对照

| PRD 需求（P0） | R&D_PLAN 覆盖 | 阶段 | 状态 |
|---------------|--------------|------|------|
| ReAct Agent 核心推理循环 | 2.7 + 2.8 + 2.11 | Phase 2 | 已覆盖 |
| 多步骤决策 | 2.7（ReAct 循环内） | Phase 2 | 已覆盖 |
| 异常重试 | 2.10 | Phase 2 | 已覆盖 |
| CodeAgent 代码解析 | 3.1 | Phase 3 | 已覆盖 |
| CodeAgent 代码执行 | 3.2 | Phase 3 | 已覆盖 |
| 沙箱隔离（代码执行） | 1.5 + 3.2（复用 Phase 1 沙箱） | Phase 1 + 3 | 已覆盖，提前交付 |
| Git 工具（add/commit/push） | 2.5 | Phase 2 | 已覆盖 |
| 文件工具（读/写/删） | 2.4 | Phase 2 | 已覆盖 |
| 工具接口标准化 | 1.8 | Phase 1 | 已覆盖 |
| GPT/Claude 模型接入 | 2.1 + 2.2 | Phase 2 | 已覆盖 |
| 流式输出 | 2.1 + 2.2 + 2.9 | Phase 2 | 已覆盖 |
| 模型切换 | 1.2 + 4.6 | Phase 1 + 4 | 已覆盖 |
| 沙箱隔离（基础） | 1.4 + 1.5 | Phase 1 | 已覆盖，前移 |
| 权限控制 | 3.4 | Phase 3 | 已覆盖 |
| 操作审计 | 3.5 | Phase 3 | 已覆盖 |
| 事件总线 | 0.7 | Phase 0 | 已覆盖，前移 |
| 生命周期钩子 | 4.2 | Phase 4 | 已覆盖 |
| 结构化日志 | 3.7 | Phase 3 | 已覆盖 |
| 调试模式 | 3.8 | Phase 3 | 已覆盖 |
| 错误分类 | 4.4 + `src/errors/` | Phase 4 | 已覆盖 |
| 重试策略 | 2.10 | Phase 2 | 已覆盖 |
| Agent 配置 | 4.6 | Phase 4 | 已覆盖 |
| 环境变量 | 4.6 | Phase 4 | 已覆盖 |
| ESModule/CJS 双模块 | 0.2 | Phase 0 | 已覆盖 |

---

## 10. v1.x 迭代计划（MVP 发布后）

| 迭代 | 内容 | 预估周期 |
|-----|------|---------|
| v1.1 | MCP 协议客户端支持 | 2 周 |
| v1.2 | 通义/DeepSeek/Ollama 模型接入 | 1.5 周 |
| v1.3 | Claude Code Skill 加载执行 | 1 周 |
| v1.4 | 条件分支 + 操作审计增强 | 1 周 |
| v1.5 | 自定义工具注册 + 运行时配置热更新 | 1.5 周 |
| v1.6 | Git 工具增强（log/diff） | 1 周 |

---

## 11. v2.x 演进计划

| 迭代 | 内容 | 预估周期 |
|-----|------|---------|
| v2.0 | 多 Agent 协作 | 3 周 |
| v2.1 | 异常拦截 + 人工审批流 | 2 周 |
| v2.2 | 操作回滚 | 2 周 |
| v2.3 | 执行超时控制（全局 + 单任务） | 1 周 |
| v2.4 | CLI 初始化命令（npx lqiao init） | 1 周 |
| v2.5 | Git 工具增强（branch/merge） | 1 周 |
