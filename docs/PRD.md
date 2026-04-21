# LQiao / 灵桥 — 产品需求文档（PRD）

> 版本：v1.0
> 日期：2026-04-21
> 状态：初版

---

## 1. 产品概述

### 1.1 产品名称

LQiao / 灵桥

### 1.2 产品定位

一款原生 TypeScript 编写的 AI 智能体框架库，核心定位为「轻量可嵌入、多生态兼容、企业级可用」，专为 TypeScript/JavaScript 项目设计，用于构建具备自主决策、工具调用、流程闭环能力的 AI 智能体。

### 1.3 目标用户

| 用户类型 | 典型场景 |
|---------|---------|
| 前端开发者 | 前端代码生成、ESLint 错误修复、打包构建辅助 |
| Node.js 后端开发者 | 文件批量处理、日志分析、接口调用自动化 |
| VS Code 插件开发者 | 代码 bug 定位修复、Git 提交推送自动化 |
| 企业运维团队 | 私有化部署、本地模型（Ollama）接入、数据不出网 |
| 多框架用户 | MCP 协议对接、Claude Code Skill 复用、从其他框架迁移 |

### 1.4 核心价值主张

- **轻量**：核心代码 < 5000 LOC，无厚重依赖，冷启动 < 100ms
- **原生**：TypeScript 全量原生，类型定义完整，无需跨语言适配
- **兼容**：支持 GPT/Claude/通义/DeepSeek/Ollama 等多模型，兼容 MCP 协议与 Claude Code Skill 格式
- **安全**：内置沙箱隔离、权限控制、操作审计，满足企业级生产要求

---

## 2. 产品架构

### 2.1 分层架构

灵桥采用「分层解耦 + 事件驱动」架构，分为四层。事件流方向：**请求自上而下，事件/钩子自下而上**。

```
  ┌─────────────────────────────────────────┐
  │           安全层（Security Layer）        │
  │   沙箱隔离 │ 权限控制 │ 操作审计           │
  ├─────────────────────────────────────────┤
  │           智能体层（Agent Layer）         │
  │   ReAct Agent │ CodeAgent │ 多Agent协作  │
  ├─────────────────────────────────────────┤
  │           工具层（Tool Layer）            │
  │   Git工具 │ 文件工具 │ MCP工具 │ 自定义工具│
  ├─────────────────────────────────────────┤
  │           模型层（Model Layer）           │
  │   GPT │ Claude │ 通义 │ DeepSeek │ Ollama│
  └─────────────────────────────────────────┘
    ▲ 请求流向：用户 → 智能体层 → 工具层 → 模型层
    ▼ 事件/钩子：各层通过事件总线向上层通知状态变化
```

### 2.2 各层职责

| 层级 | 职责 | 关键能力 |
|-----|------|---------|
| 模型层 | 统一封装大模型调用 | 流式输出、上下文管理、模型切换、自动重试 |
| 智能体层 | 意图解析与任务调度 | ReAct 推理循环、代码执行、多 Agent 协作 |
| 工具层 | 标准化工具接口 | Git/文件/MCP 内置工具、自定义工具注册 |
| 安全层 | 运行安全保障 | 沙箱隔离、权限限制、操作审计、异常回滚 |

---

## 3. 功能需求

### 3.1 智能体核心能力

#### 3.1.1 ReAct Agent

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| ReAct 推理循环 | 实现「思考-行动-观察」循环机制 | P0 |
| 多步骤决策 | 支持复杂长任务的步骤规划与执行 | P0 |
| 异常重试 | 执行失败时自动重试 | P0 |
| 条件分支 | 根据执行结果动态调整后续步骤 | P1 |
| 多 Agent 协作 | 支持多个 Agent 分工协作（如编码 Agent + 运维 Agent） | P2 |

#### 3.1.2 CodeAgent

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 代码解析 | 解析 LLM 输出的代码块 | P0 |
| 代码执行 | 支持 TypeScript/JavaScript 代码实时运行 | P0 |
| 沙箱隔离 | 代码执行在隔离环境中运行 | P0 |
| 执行超时控制 | 限制代码执行时间，避免死循环 | P1 |

### 3.2 内置工具集

#### 3.2.1 Git 工具

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| git add | 添加文件到暂存区 | P0 |
| git commit | 提交代码 | P0 |
| git push | 推送到远程仓库 | P0 |
| git log | 查询提交日志 | P1 |
| git diff | 查看文件差异 | P1 |
| git branch | 分支管理 | P2 |

#### 3.2.2 文件工具

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 文件读取 | 读取文件内容 | P0 |
| 文件写入 | 写入文件内容 | P0 |
| 文件删除 | 删除文件 | P0 |
| 目录遍历 | 列出目录内容 | P1 |

#### 3.2.3 MCP 工具

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| MCP 客户端 | 连接外部 MCP Server | P1 |
| MCP Server | 对外提供 MCP 工具服务 | P1 |
| 协议兼容 | 严格遵循 Model Context Protocol 标准 | P1 |

#### 3.2.4 自定义工具

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 工具注册 | 通过装饰器/注册表方式封装自有工具 | P1 |
| 工具接口标准化 | 统一工具输入输出格式，适配 MCP 协议 | P0 |

### 3.3 模型适配

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| GPT 系列 | 支持 OpenAI GPT 模型调用 | P0 |
| Claude 系列 | 支持 Anthropic Claude 模型调用 | P0 |
| 通义千问 | 支持阿里云通义模型调用 | P1 |
| DeepSeek | 支持 DeepSeek 模型调用 | P1 |
| Ollama | 支持本地 Ollama 模型部署 | P1 |
| 模型切换 | 一行代码切换模型，统一接口 | P0 |
| 流式输出 | 支持模型流式返回 | P0 |

### 3.4 安全层

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 沙箱隔离 | 代码执行、文件操作在隔离环境中运行 | P0 |
| 权限控制 | 可限制操作权限（禁止删除系统文件、禁止远程 Push 等） | P0 |
| 操作审计 | 记录智能体所有操作日志 | P1 |
| 异常拦截 | 支持高危操作拦截与人工审批 | P1 |
| 操作回滚 | 支持异常场景下的操作回滚 | P1 |

### 3.5 Claude Code Skill 兼容

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| Skill 加载 | 支持直接加载 Markdown 格式的 Claude Code Skill | P1 |
| Skill 执行 | 解析并执行 Skill 脚本 | P1 |

### 3.6 错误处理

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 错误分类 | 区分网络错误、模型拒绝、工具执行错误、权限拦截等类型 | P0 |
| 重试策略 | 支持指数退避重试，可配置最大重试次数 | P0 |
| 降级方案 | 模型不可用时返回结构化错误信息，支持 fallback 模型切换 | P1 |

### 3.7 配置管理

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| Agent 配置 | 支持 model、apiKey、tools、sandbox 等初始化参数 | P0 |
| 环境变量 | 支持通过环境变量注入敏感配置（如 API Key） | P0 |
| 运行时配置 | 支持动态修改 Agent 参数（如切换模型、增删工具） | P1 |

### 3.8 事件与钩子系统

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 事件总线 | 各层通过统一事件总线向上层通知状态变化 | P0 |
| 生命周期钩子 | 支持 beforeRun / afterRun / onToolCall / onError 等钩子 | P0 |
| 自定义钩子 | 开发者可注册自定义事件监听器 | P1 |

### 3.9 日志与可观测性

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 结构化日志 | 输出 JSON 格式日志，包含时间戳、层级、事件类型 | P0 |
| 调试模式 | 支持 verbose 模式，输出完整的 ReAct 推理链路 | P0 |
| 性能指标 | 记录每次工具调用耗时、模型响应时间等 | P1 |

### 3.10 CLI / 初始化

| 需求项 | 描述 | 优先级 |
|-------|------|-------|
| 项目初始化 | `npx lqiao init` 快速生成脚手架 | P1 |
| 模板选择 | 支持选择基础模板（Node.js / VS Code / 前端） | P1 |

---

## 4. 非功能需求

### 4.1 性能

| 指标 | 目标值 |
|-----|-------|
| 冷启动时间 | < 100ms |
| 打包后体积 | < 50KB（gzip） |
| 核心代码行数 | < 5000 LOC |
| 单次工具调用延迟 | < 50ms（本地工具） |

### 4.2 兼容性

| 维度 | 要求 |
|-----|------|
| 模块规范 | 支持 ESModule / CommonJS 双模块 |
| TypeScript 版本 | >= 4.9 |
| Node.js 版本 | >= 18 |
| 运行环境 | Node.js 后端、前端工程、VS Code 插件、Electron 应用 |

### 4.3 可维护性

| 维度 | 要求 |
|-----|------|
| 类型定义 | 完整覆盖，开箱即用 |
| 分层解耦 | 各层独立，便于自定义开发与维护 |
| 开发体验 | 与常规 TS 项目完全一致 |

### 4.4 安全性

| 维度 | 要求 |
|-----|------|
| 代码执行 | 沙箱隔离，防恶意代码 |
| 文件操作 | 权限限制，防误删 |
| 企业合规 | 满足企业级生产安全要求 |

---

## 5. 适用场景与需求映射

| 场景 | 核心需求 | 涉及模块 |
|-----|---------|---------|
| 代码运维智能体 | Bug 定位修复、Git 提交推送 | ReAct Agent + Git/文件工具 |
| Node.js 服务自动化 | 文件处理、日志分析、接口调用 | ReAct Agent + 文件工具 + 自定义工具 |
| 前端工程助手 | 代码生成、ESLint 修复、构建辅助 | CodeAgent + 文件工具 |
| 私有化部署 | 本地模型、数据不出网 | 模型层（Ollama）+ 安全层 |
| MCP 协议对接 | 多框架互联互通 | MCP 工具 + 工具层 |

---

## 6. API 设计

### 6.1 快速入门

```typescript
import { Agent, GitTool, FileTool } from 'lqiao';

// 1. 初始化智能体
const agent = new Agent({
  model: 'claude-3.7',
  apiKey: 'your-api-key',
  tools: [new FileTool(), new GitTool()],
  sandbox: true,
});

// 2. 执行任务
const result = await agent.run(`
  1. 读取 src/main.ts，定位 bug
  2. 修复 bug 逻辑
  3. git add src/main.ts
  4. git commit -m "fix: 修复 main.ts 逻辑错误"
`);
```

### 6.2 流式输出

```typescript
for await (const chunk of agent.stream('逐步分析并修复 src/main.ts 中的错误')) {
  console.log(chunk.text);
}
```

### 6.3 CodeAgent

```typescript
import { CodeAgent } from 'lqiao';

const codeAgent = new CodeAgent({
  model: 'gpt-4o',
  sandbox: true,
  timeout: 30_000, // 执行超时 30s
});

await codeAgent.execute('写一个函数计算数组平均值，并运行测试');
```

### 6.4 自定义工具注册

```typescript
import { Tool, Agent } from 'lqiao';

class WeatherTool extends Tool {
  name = 'weather';
  description = '查询指定城市的天气';

  async execute(city: string) {
    const res = await fetch(`https://api.weather.com/${city}`);
    return res.json();
  }
}

const agent = new Agent({
  model: 'claude-3.7',
  tools: [new WeatherTool()],
});
```

### 6.5 事件钩子

```typescript
const agent = new Agent({ model: 'claude-3.7' });

agent.on('beforeRun', (task) => console.log('开始执行:', task));
agent.on('onToolCall', (toolName, args) => console.log('调用工具:', toolName, args));
agent.on('onError', (error) => console.error('执行错误:', error));
agent.on('afterRun', (result) => console.log('执行完成:', result));
```

### 6.6 错误处理

```typescript
try {
  const result = await agent.run('修复代码并提交到 Git');
} catch (error) {
  if (error.type === 'MODEL_ERROR') {
    // 切换备用模型重试
    agent.switchModel('gpt-4o');
    return agent.run('修复代码并提交到 Git');
  }
  if (error.type === 'SANDBOX_VIOLATION') {
    console.warn('沙箱拦截:', error.message);
  }
  throw error;
}
```

---

## 7. 与主流框架对比定位

| 对比维度 | LQiao / 灵桥 | LangChain | AgentScope | smolagents |
|---------|-------------|-----------|------------|------------|
| 语言 | TypeScript 原生 | Python/JS | Python/Java | Python |
| 体积 | < 50KB gzip | 厚重，依赖多 | 企业级，较重 | 轻量 |
| TS 项目嵌入 | 原生无缝 | 需额外适配 | 不适合 | 不适合 |
| 核心范式 | ReAct + CodeAgent | 通用 Chain | 多 Agent | 轻量 Agent |
| 适用生态 | 前端/Node.js/VS Code | 通用 AI | 企业级部署 | Python 生态 |
| 沙箱安全 | 内置 | 需自行实现 | 部分支持 | 基础支持 |

---

## 8. 版本规划

### v1.0（MVP）

- [ ] ReAct Agent 核心推理循环
- [ ] CodeAgent 代码执行
- [ ] Git 工具（add/commit/push）
- [ ] 文件工具（读/写/删）
- [ ] 模型层基础（GPT/Claude 接入）
- [ ] 沙箱隔离 + 权限控制
- [ ] 事件总线与生命周期钩子
- [ ] 结构化日志与调试模式
- [ ] ESModule/CommonJS 双模块支持

### v1.x（迭代）

- [ ] MCP 协议完整支持（Client + Server）
- [ ] Claude Code Skill 加载执行
- [ ] 通义/DeepSeek/Ollama 模型接入
- [ ] 条件分支与异常重试
- [ ] 操作审计日志
- [ ] 自定义工具注册机制
- [ ] 运行时配置热更新

### v2.x（演进）

- [ ] 多 Agent 协作
- [ ] Git 工具增强（branch/diff/merge）
- [ ] 异常拦截与人工审批
- [ ] 操作回滚
- [ ] 执行超时控制
- [ ] CLI 初始化命令（npx lqiao init）

---

## 9. 风险与约束

| 风险项 | 影响等级 | 影响描述 | 缓解措施 |
|-------|---------|---------|---------|
| 沙箱逃逸 | P0 | 代码执行突破隔离，可能导致系统文件被篡改或数据泄露 | 多层隔离，权限最小化，高危操作拦截 |
| 模型 API 变更 | P0 | 上游模型接口变更导致调用失效，服务不可用 | 统一抽象层屏蔽差异，支持 fallback 模型切换 |
| 隐私合规 | P1 | 企业数据经第三方模型 API 出境，触发合规风险 | Ollama 本地部署支持，数据不出网 |
| 生态竞争 | P1 | LangChain 等框架推出 TS 原生版本，削弱差异化 | 聚焦 TS/JS 生态轻量化与嵌入性优势 |
