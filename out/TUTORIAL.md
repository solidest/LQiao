# LQiao / 灵桥 — 开发者教程

> 版本：v1.5（Skill 运行时 + MCP 客户端 + 分支引擎 + 审计日志）
> 日期：2026-04-21
> 适用版本：lqiao >= 0.1.0

---

## 目录

1. [快速入门](#1-快速入门)
2. [核心概念](#2-核心概念)
3. [Agent 配置与初始化](#3-agent-配置与初始化)
4. [Skill 技能系统](#4-skill-技能系统)
5. [模型适配](#5-模型适配)
6. [内置工具](#6-内置工具)
7. [MCP 客户端（远程工具）](#7-mcp-客户端远程工具)
8. [自定义工具](#8-自定义工具)
9. [ReAct Agent 推理循环](#9-react-agent-推理循环)
10. [CodeAgent 代码执行](#10-codeagent-代码执行)
11. [沙箱与安全](#11-沙箱与安全)
12. [事件系统](#12-事件系统)
13. [日志与可观测性](#13-日志与可观测性)
14. [错误处理](#14-错误处理)
15. [重试策略](#15-重试策略)
16. [流式输出](#16-流式输出)
17. [实战场景](#17-实战场景)
18. [高级用法](#18-高级用法)
19. [故障排查](#19-故障排查)

---

## 1. 快速入门

### 1.1 安装

```bash
bun add lqiao
# 或
npm install lqiao
```

### 1.2 最小可运行示例

用自然语言描述任务，Agent 自动规划并执行：

```typescript
import { Agent, FileTool, GitTool } from 'lqiao';

const agent = new Agent({
  model: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  tools: [new FileTool(), new GitTool()],
  sandbox: true,
});

const result = await agent.run(
  '读取 README.md 的内容，统计其中的标题数量'
);
console.log(result);
```

**工作流程：**
1. Agent 创建模型实例（根据 `model` 字符串自动匹配）
2. 注入工具列表（FileTool、GitTool）
3. 启动 ReAct 推理循环：思考 → 调用工具 → 观察结果 → 继续
4. 达到最终答案后返回

### 1.3 运行环境要求

| 要求 | 最低版本 |
|-----|---------|
| Node.js | 18+ |
| TypeScript | 5.7+ |
| 模块格式 | ESM（`"type": "module"`）或 CommonJS |

---

## 2. 核心概念

### 2.1 架构分层（四层事件驱动）

```
用户任务
   │
   ▼
┌─────────────────────────────────┐
│   Agent 主类                     │  ← 入口：run() / stream()
│   运行时：addSkill / addTool /   │
│   updateConfig / switchModel     │
├─────────────────────────────────┤
│  安全层 Security Layer           │
│  Sandbox │ PermissionManager     │
│  AuditLog                       │
├─────────────────────────────────┤
│  Agent 层 Agent Layer            │
│  ReactAgent │ CodeAgent          │
│  SkillRegistry │ SkillLoader     │
├─────────────────────────────────┤
│  工具层 Tool Layer               │
│  FileTool │ GitTool             │
│  MCPClient │ MCPToolAdapter      │
│  ToolRegistry                   │
├─────────────────────────────────┤
│  模型层 Model Layer              │
│  OpenAI │ Anthropic │ DashScope  │
│  DeepSeek │ Ollama │ Registry    │
└─────────────────────────────────┘
              ↕ Event Bus ↕
       Logger │ Profiler
```

### 2.2 关键类关系

| 类 | 职责 | 何时使用 |
|---|------|---------|
| `Agent` | 主入口，聚合所有能力 | 99% 的场景用这个 |
| `ReactAgent` | ReAct 推理循环引擎 | 需要自定义 prompt 或手动调度时 |
| `CodeAgent` | 代码解析与执行 | 需要执行 LLM 生成的代码时 |
| `MCPClient` | MCP 协议客户端 | 连接外部 MCP Server 发现远程工具 |
| `SkillRegistry` | 技能注册管理 | 运行时加载/启用/禁用技能 |
| `BaseModel` | 模型适配器基类 | 接入新模型时继承 |
| `ToolBase` | 工具基类 | 编写自定义工具时继承 |
| `Sandbox` | 沙箱隔离 | 文件路径限制 + VM 代码隔离 |
| `DefaultEventBus` | 事件总线 | 监听 Agent 内部事件 |
| `AuditLog` | 审计日志 | 记录工具调用、过滤、导出 |
| `Logger` | 结构化日志 | JSON 格式日志，多级别 |
| `Profiler` | 性能分析 | start/stop + 统计 |

---

## 3. Agent 配置与初始化

### 3.1 完整配置项

```typescript
import { Agent, FileTool } from 'lqiao';

const agent = new Agent({
  // 必填：模型标识符
  model: 'gpt-4o',

  // 必填：API Key（建议从环境变量读取）
  apiKey: process.env.OPENAI_API_KEY!,

  // 可选：工具列表
  tools: [new FileTool()],

  // 可选：沙箱（布尔值或配置对象）
  sandbox: true,

  // 可选：最大推理步数（默认 50）
  maxSteps: 20,

  // 可选：最大重试次数（默认 3）
  maxRetries: 5,

  // 可选：调试模式（默认 false）
  verbose: true,

  // 可选：MCP 服务器配置（连接后工具自动可用）
  mcpServers: [
    { command: 'npx', args: ['@modelcontextprotocol/server-filesystem', '/tmp'] },
  ],

  // 可选：初始技能列表
  skills: [logAnalysisSkill],
});
```

### 3.2 沙箱配置

```typescript
import { Agent } from 'lqiao';

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  sandbox: {
    // 允许访问的路径（白名单）
    allowedPaths: [process.cwd(), '/tmp/agent-workspace'],

    // 禁止访问的路径（黑名单）
    blockedPaths: ['/etc', '/root', process.env.HOME + '/.ssh'],

    // 禁止的命令
    blockedCommands: ['rm -rf', 'del /s', 'format'],

    // 代码执行超时（毫秒）
    timeout: 10000,

    // 内存限制（MB）
    memoryLimit: 128,
  },
});
```

### 3.3 运行时切换模型

```typescript
// 从 GPT 切换到 Claude
agent.switchModel('claude-sonnet-4-6', process.env.ANTHROPIC_API_KEY);

// 仅切换模型标识符（API Key 不变）
agent.switchModel('gpt-4o-mini');
```

### 3.4 运行时配置更新

```typescript
// 更新推理参数
agent.updateConfig({ maxSteps: 30, maxRetries: 5, verbose: true });

// 更新沙箱配置
agent.updateSandbox(new Sandbox({ allowedPaths: ['/tmp'] }));

// 查看当前配置
console.log(agent.config.maxSteps);
```

### 3.5 环境变量注入

```typescript
const agent = new Agent({
  model: process.env.MODEL_ID ?? 'gpt-4o',
  apiKey: process.env.MODEL_API_KEY!,
  tools: [],
  sandbox: true,
});
```

---

## 4. Skill 技能系统

Skill 是可插拔的领域能力包，包含系统提示词和专属工具。

### 4.1 Skill 结构

```typescript
interface SkillConfig {
  name: string;           // 唯一标识
  description: string;    // 用于模型发现的人类可读描述
  prompt: string;         // 注入到 ReAct Agent 的系统提示词片段
  tools?: Tool[];         // 该技能贡献的工具
  enabled?: boolean;      // 是否激活（默认 true）
}
```

### 4.2 运行时添加技能

```typescript
import { Agent, FileTool, Sandbox } from 'lqiao';
import { readFileSync, existsSync } from 'fs';

const sandbox = new Sandbox({ allowedPaths: [process.cwd()] });

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool(sandbox)],
  sandbox: true,
});

// 添加日志分析技能
agent.addSkill({
  name: 'log-analyzer',
  description: 'Analyze log files for errors and patterns',
  prompt: 'You are a log analysis expert. Look for ERROR/WARN patterns.',
  tools: [{
    name: 'log_reader',
    description: 'Read and parse log files',
    version: '1.0.0',
    execute: async (path: string) => {
      if (!existsSync(path)) {
        return { success: false, error: 'File not found' };
      }
      const content = readFileSync(path, 'utf-8');
      const errors = content.split('\n').filter(l => l.includes('ERROR'));
      return { success: true, data: { errors } };
    },
  }],
});

console.log('Skills:', agent.getSkills().map(s => s.name));
```

### 4.3 技能启用/禁用/移除

```typescript
// 禁用技能（提示词和工具都失效）
agent.disableSkill('log-analyzer');

// 重新启用
agent.enableSkill('log-analyzer');

// 完全移除技能及其工具
agent.removeSkill('log-analyzer');
```

### 4.4 工具热替换

```typescript
import { GitTool } from 'lqiao';

// 添加新工具（如果同名工具已存在则替换）
agent.addTool(new GitTool(sandbox, process.cwd()));

// 移除工具
agent.removeTool('log_reader');

// 清空所有工具和技能
agent.clearTools();
```

---

## 5. 模型适配

### 5.1 内置支持的模型

| 模型标识符前缀 | 对应适配器 | 可用模型示例 |
|--------------|-----------|-------------|
| `gpt-` | OpenAI | gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4o-mini |
| `o1` | OpenAI | o1, o1-mini |
| `o3` | OpenAI | o3, o3-mini |
| `claude-` | Anthropic | claude-3.5-sonnet, claude-3.7, claude-sonnet-4-6 |
| `qwen-` | DashScope | qwen-max, qwen-plus, qwen-turbo |
| `deepseek` | DeepSeek | deepseek-chat |
| `ollama/` | Ollama | llama3.1, qwen2.5, mistral |

### 5.2 OpenAI 模型

```typescript
import { OpenAIModel } from 'lqiao';

const model = new OpenAIModel({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',

  // 可选：自定义 API 地址（兼容 Ollama、本地代理等）
  baseUrl: 'https://api.openai.com/v1',
});

const result = await model.generate('你好，请介绍自己', {
  maxTokens: 1000,
  temperature: 0.7,
});

console.log(result.text);
console.log('Token 使用:', result.usage);
// { promptTokens: 12, completionTokens: 85 }
```

### 5.3 Anthropic Claude 模型

```typescript
import { AnthropicModel } from 'lqiao';

const model = new AnthropicModel({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-6',
});

const result = await model.generate('写一个快速排序的 TypeScript 实现', {
  maxTokens: 2000,
  temperature: 0.3,

  // Claude 特有的 system prompt
  system: '你是一个资深的 TypeScript 工程师',
});
```

### 5.4 DashScope 通义千问

```typescript
import { DashScopeModel } from 'lqiao';

const model = new DashScopeModel({
  apiKey: process.env.DASHSCOPE_API_KEY!,
  model: 'qwen-max',
});

const result = await model.generate('用中文解释什么是 ReAct Agent');
```

### 5.5 DeepSeek

```typescript
import { DeepSeekModel } from 'lqiao';

const model = new DeepSeekModel({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  model: 'deepseek-chat',
});

const result = await model.generate('写一个二分查找函数');
```

### 5.6 Ollama 本地模型

```typescript
import { OllamaModel } from 'lqiao';

const model = new OllamaModel({
  apiKey: 'ignored',  // Ollama 不需要 API Key
  model: 'llama3.1',
  // baseUrl 默认为 http://localhost:11434
});

const result = await model.generate('本地模型测试');
```

### 5.7 注册自定义模型

如果模型标识符不在内置列表中，可以通过注册表添加：

```typescript
import { modelRegistry } from 'lqiao';

// 注册一个兼容 OpenAI API 的本地模型
modelRegistry.registerProvider('my-llm', {
  provider: 'openai',
  baseUrl: 'http://localhost:8080/v1',
});

// 然后可以直接使用
const agent = new Agent({
  model: 'my-llama3',
  apiKey: 'ignored',
  tools: [],
});
```

ModelRegistry 的 `create()` 方法按前缀匹配自动选择适配器，`resolve()` 可查看解析结果。

---

## 6. 内置工具

### 6.1 文件工具（FileTool）

支持三种操作：`read`、`write`、`delete`。

```typescript
import { Agent, FileTool, Sandbox } from 'lqiao';

const sandbox = new Sandbox({
  allowedPaths: [process.cwd()],
});

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool(sandbox)],
  sandbox,
});

// Agent 会自动调用 FileTool 完成文件操作
const result = await agent.run(
  '读取 package.json 并告诉我 dependencies 有哪些'
);
```

**工具调用协议：**
- 模型返回 `Action: file` + `Action Input: {"action": "read", "path": "package.json"}`
- Agent 解析后调用 `fileTool.execute({ action: 'read', path: 'package.json' })`

### 6.2 Git 工具（GitTool）

支持三种操作：`add`、`commit`、`push`。

```typescript
import { Agent, GitTool, Sandbox } from 'lqiao';

const sandbox = new Sandbox({ allowedPaths: [process.cwd()] });

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new GitTool(sandbox)],
});

// Agent 可自主完成 Git 工作流
await agent.run(`
  1. 将所有 .ts 文件添加到暂存区
  2. 提交代码，消息为 "feat: 添加新功能"
  3. 推送到 origin 的 main 分支
`);
```

**Git 工具方法签名：**

| 操作 | 参数 |
|-----|------|
| `add` | `{ action: 'add', paths: string[] }` |
| `commit` | `{ action: 'commit', message: string, author?: string }` |
| `push` | `{ action: 'push', remote?: string, branch?: string }` |

**注意**：LLM 有时用数字键格式 `{ "0": "add", "1": ["file.ts"] }` 传参，GitTool 会自动兼容此格式。

### 6.3 工具注册表（独立使用）

```typescript
import { ToolRegistry, FileTool, GitTool } from 'lqiao';

const registry = new ToolRegistry();
registry.register(new FileTool());
registry.register(new GitTool());

console.log(registry.size);  // 2
console.log(registry.has('file')); // true
console.log(registry.list()); // [FileTool, GitTool]

registry.remove('file');
```

---

## 7. MCP 客户端（远程工具）

MCP（Model Context Protocol）允许 Agent 连接外部 Server 发现并调用远程工具。

### 7.1 传输方式

| 传输 | 说明 |
|------|------|
| Stdio | 子进程标准输入输出，适合本地服务 |
| SSE | HTTP Server-Sent Events，适合远程服务 |

### 7.2 手动管理 MCP 生命周期

```typescript
import { MCPClient, MCPClient: { MCP_EVENTS }, wrapMCPTools, Agent } from 'lqiao';

// 创建 MCP 客户端
const client = new MCPClient({
  name: 'echo-server',
  transport: 'stdio',
  command: 'node',
  args: ['echo-server.cjs'],
  timeout: 10000,
});

// 监听连接事件
client.on(MCP_EVENTS.STATE_CHANGE, (data) => {
  console.log(`状态: ${data.state}`);
});
client.on(MCP_EVENTS.TOOLS_DISCOVERED, (data) => {
  console.log(`发现 ${data.tools} 个工具`);
});

// 连接并发现工具
await client.connect();

// 直接调用远程工具
const result = await client.callTool('echo', { message: 'Hello from LQiao!' });
console.log('响应:', result);

// 适配为内部 Tool 接口（可注入 Agent）
const adaptedTools = wrapMCPTools(client);
console.log(`已适配 ${adaptedTools.length} 个工具`);

// 使用完毕后断开
await client.disconnect();
```

### 7.3 SSE 传输（远程 MCP Server）

```typescript
import { MCPClient } from 'lqiao';

const client = new MCPClient({
  name: 'remote-mcp',
  transport: 'sse',
  sseUrl: 'http://localhost:3000/mcp',
  timeout: 30000,
});

await client.connect();
// SSE 会自动发现 endpoint 并建立长连接
const tools = client.getTools();
```

### 7.4 Agent 自动初始化 MCP

通过 `mcpServers` 配置，Agent 在 `run()` 时自动连接并发现工具：

```typescript
const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [],
  mcpServers: [
    {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
  ],
});

// MCP 工具自动可用，无需额外代码
const result = await agent.run('读取 /tmp/data.json 并总结');
```

---

## 8. 自定义工具

### 8.1 继承 ToolBase

所有自定义工具必须继承 `ToolBase` 并实现 `doExecute` 方法：

```typescript
import { ToolBase, Agent, type ToolResult } from 'lqiao';

class WeatherTool extends ToolBase {
  name = 'weather';
  description = '查询指定城市的天气信息';

  protected async doExecute(...args: unknown[]): Promise<ToolResult> {
    const city = typeof args[0] === 'string'
      ? args[0]
      : (args[0] as Record<string, unknown>)?.city as string;

    if (!city) {
      return { success: false, error: '请提供城市名称' };
    }

    try {
      const res = await fetch(
        `https://api.weather.com/v1/current?q=${encodeURIComponent(city)}`
      );
      const data = await res.json();
      return { success: true, data };
    } catch (e) {
      return {
        success: false,
        error: `天气查询失败: ${e}`,
      };
    }
  }
}

// 使用
const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new WeatherTool()],
});

const result = await agent.run('查询北京今天的天气');
```

### 8.2 ToolResult 结构

```typescript
interface ToolResult {
  success: boolean;      // 是否成功
  data?: unknown;        // 成功时的返回数据
  error?: string;        // 失败时的错误信息
  metadata?: Record<string, unknown>;  // 可选的元数据
}
```

---

## 9. ReAct Agent 推理循环

### 9.1 工作原理

ReAct Agent 执行以下循环：

```
Step 1: 构造 prompt（系统提示 + 工具列表 + 任务 + 历史）
Step 2: 调用 LLM → 解析输出
Step 3: 如果输出包含 Action → 调用对应工具 → 记录 Observation
Step 4: 如果输出包含 Final Answer → 返回结果，结束循环
Step 5: 如果达到 maxSteps → 抛出 MAX_STEPS 错误
```

### 9.2 LLM 输出格式约定

模型需要按以下格式输出：

```
Thought: 我需要先读取文件内容
Action: file
Action Input: {"action": "read", "path": "package.json"}
```

工具执行后，Agent 将结果追加为：

```
Observation: {"success": true, "data": "{...}"}
```

最终答案格式：

```
Thought: 我已经获取了所有信息
Final Answer: 该项目有 3 个依赖...
```

### 9.3 直接使用 ReactAgent

如果不需要 `Agent` 主类的聚合能力，可以直接使用 `ReactAgent`：

```typescript
import { ReactAgent, FileTool, OpenAIModel } from 'lqiao';

const model = new OpenAIModel({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

const reactAgent = new ReactAgent({
  tools: [new FileTool()],
  maxSteps: 10,
  maxRetries: 2,
});

const result = await reactAgent.run(
  (prompt) => model.generate(prompt),
  '读取 README.md 并统计行数'
);
```

### 9.4 Prompt 截断保护

当对话历史超过 100,000 字符时，ReAct Agent 自动截断较早的步骤，保留系统提示头和最近的上下文，防止超出模型窗口限制。

---

## 10. CodeAgent 代码执行

### 10.1 从文本中提取并执行代码

```typescript
import { CodeAgent, Sandbox } from 'lqiao';

const codeAgent = new CodeAgent(new Sandbox({ timeout: 5000 }));

// 从 LLM 响应中提取代码并执行
const llmResponse = `
Here's the solution:

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
\`\`\`
`;

const results = await codeAgent.executeFromResponse(llmResponse);
console.log(results);
// [{ success: true, output: 55 }]
```

### 10.2 直接执行代码

```typescript
import { CodeAgent } from 'lqiao';

const codeAgent = new CodeAgent();

const result = await codeAgent.executeCode(
  'const arr = [1, 2, 3]; arr.reduce((a, b) => a + b, 0)'
);

console.log(result);
// { success: true, output: 6 }
```

### 10.3 结合模型使用

```typescript
import { CodeAgent, OpenAIModel } from 'lqiao';

const model = new OpenAIModel({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

const codeAgent = new CodeAgent();

const results = await codeAgent.runWithModel(
  (prompt) => model.generate(prompt),
  '写一个函数计算 [1,2,3,4,5] 的平均值'
);
```

### 10.4 沙箱安全

CodeAgent 默认使用沙箱执行代码，以下操作会被阻止：

```typescript
const codeAgent = new CodeAgent();

// 这些会被沙箱拦截
await codeAgent.executeCode('require("fs")');        // require 被禁用
await codeAgent.executeCode('process.exit()');        // process 被禁用
await codeAgent.executeCode('fetch("http://evil.com")'); // 网络访问不可用
```

---

## 11. 沙箱与安全

### 11.1 文件沙箱

沙箱限制文件操作在指定目录内：

```typescript
import { Sandbox } from 'lqiao';

const sandbox = new Sandbox({
  allowedPaths: ['/tmp/agent-workspace'],
  blockedPaths: ['/tmp/agent-workspace/secrets'],
});

// 允许：在允许的路径内
sandbox.validatePath('/tmp/agent-workspace/file.txt'); // OK

// 拒绝：超出允许的路径
sandbox.validatePath('/etc/passwd');
// 抛出 LQiaoError: Path outside allowed directories
```

### 11.2 权限控制

在沙箱之上，可以添加更细粒度的权限规则：

```typescript
import { PermissionManager } from 'lqiao';

const perms = new PermissionManager();

// 禁止删除操作
perms.deny('delete', '防止误删');

// 禁止 push 到特定分支
perms.deny('push:main', '禁止直接推送主分支');

// 允许读取
perms.allow('read:*');

// 检查权限
perms.check('read:package.json'); // true
perms.check('delete:important.txt');
// 抛出 LQiaoError: Action denied: delete (防止误删)
```

**通配符匹配规则：**
- `*` 匹配同层任意字符：`read:*` 匹配 `read:file.txt`
- `**` 跨层匹配：`git:*` 匹配 `git:add`、`git:commit`

### 11.3 操作审计

记录所有工具调用：

```typescript
import { AuditLog } from 'lqiao';

const audit = new AuditLog();

// 记录工具调用
audit.record({
  tool: 'file',
  action: 'read',
  args: { path: 'package.json' },
  success: true,
  duration: 12,
});

// 查询
const allEntries = audit.getEntries();
const failed = audit.filterBySuccess(false);
const fileOps = audit.filterByTool('file');

// 导出为 JSON
const json = audit.toJSON();

// 清空
audit.clear();
```

### 11.4 默认阻止的命令

沙箱内置以下默认阻止的命令：

| 命令 | 说明 |
|-----|------|
| `rm -rf` | 递归强制删除 |
| `rm -r` | 递归删除 |
| `del /s` | Windows 删除 |
| `rmdir /s` | Windows 删除目录 |
| `format` | 格式化磁盘 |
| `shutdown` | 关机 |
| `reboot` | 重启 |

---

## 12. 事件系统

### 12.1 事件类型

| 事件 | 触发时机 | 数据 |
|-----|---------|------|
| `beforeRun` | 任务开始 | `{ task: string }` |
| `onStep` | 每步推理 | `{ step: number, prompt: string }` |
| `onToolCall` | 调用工具 | `{ tool: string, args: unknown }` |
| `onToolResult` | 工具返回 | `{ tool: string, result: ToolResult }` |
| `afterRun` | 任务完成 | `{ answer: string, steps: number }` |
| `onError` | 发生错误 | `{ task: string, error: string }` |
| `onSkillLoaded` | 技能加载 | `{ name: string }` |
| `onSkillEnabled` | 技能启用 | `{ name: string }` |
| `onSkillDisabled` | 技能禁用 | `{ name: string }` |
| `onToolRegistered` | 工具注册 | `{ name: string }` |
| `onToolUpdated` | 工具更新 | `{ name: string }` |
| `onToolRemoved` | 工具移除 | `{ name: string }` |

### 12.2 监听事件

```typescript
import { Agent, AGENT_EVENTS } from 'lqiao';

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [],
});

agent.on(AGENT_EVENTS.BEFORE_RUN, (data) => {
  console.log('开始任务:', data.task);
});

agent.on(AGENT_EVENTS.ON_TOOL_CALL, (data) => {
  console.log(`调用工具: ${data.tool}`, data.args);
});

agent.on(AGENT_EVENTS.AFTER_RUN, (data) => {
  console.log(`任务完成，共 ${data.steps} 步`);
  console.log('结果:', data.answer);
});

agent.on(AGENT_EVENTS.ON_ERROR, (data) => {
  console.error('任务失败:', data.error);
});

await agent.run('读取 package.json');
```

### 12.3 通配符事件监听

事件总线支持 glob 模式匹配：

```typescript
// 监听所有事件
agent.on('**', (data) => {
  console.log('事件:', data);
});

// 监听所有以 on 开头的事件
agent.on('on*', (data) => {
  console.log('工具相关事件:', data);
});
```

### 12.4 一次性监听

```typescript
agent.eventBus.once(AGENT_EVENTS.AFTER_RUN, (data) => {
  // 只触发一次，之后自动移除监听
  console.log('任务完成:', data.answer);
});
```

### 12.5 自定义事件

```typescript
import { DefaultEventBus } from 'lqiao';

const bus = new DefaultEventBus();

bus.on('custom:deploy', (data) => {
  console.log('部署事件:', data);
});

bus.emit('custom:deploy', { service: 'api', version: '1.0.0' });
```

---

## 13. 日志与可观测性

### 13.1 结构化日志

```typescript
import { Logger } from 'lqiao';

const logger = new Logger({
  level: 'info',
  verbose: true, // 输出 JSON 到控制台
});

logger.info('Agent 启动', { model: 'gpt-4o' });
logger.warn('沙箱未启用', { config: { sandbox: false } });
logger.error('模型调用失败', { error: 'timeout' });

// 导出全部日志为 JSON
const json = logger.toJSON();

// 查看所有条目
const entries = logger.getEntries();
```

### 13.2 调试模式

```typescript
import { Agent, Logger } from 'lqiao';

const logger = new Logger({ verbose: true });

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [],
  verbose: true, // 开启 Agent 的 verbose 模式
});

logger.verbose(); // 切换到 debug 级别
logger.debug('ReAct 循环开始', { maxSteps: 50 });
```

### 13.3 性能分析器

```typescript
import { Profiler } from 'lqiao';

const profiler = new Profiler();

// 记录耗时
profiler.start('model-call');
await model.generate('hello');
profiler.stop('model-call');

profiler.start('tool-call');
await fileTool.execute({ action: 'read', path: '/path' });
profiler.stop('tool-call');

// 查看所有记录
console.log(profiler.getRecords());
// [
//   { name: 'model-call', duration: 234, startTime: ..., endTime: ... },
//   { name: 'tool-call', duration: 5, startTime: ..., endTime: ... },
// ]

// 统计同一操作的平均和最大耗时（多次 start/stop 同一 name）
console.log(profiler.average('model-call')); // 平均
console.log(profiler.max('model-call'));     // 最大

// 清空
profiler.clear();
```

---

## 14. 错误处理

### 14.1 错误类型

| 错误类型 | 常量 | 含义 | 可重试 |
|---------|------|------|-------|
| `MODEL_ERROR` | `ERROR_TYPES.MODEL_ERROR` | 模型调用失败 | 是 |
| `TOOL_ERROR` | `ERROR_TYPES.TOOL_ERROR` | 工具执行失败 | 否 |
| `SANDBOX_VIOLATION` | `ERROR_TYPES.SANDBOX_VIOLATION` | 沙箱拦截 | 否 |
| `TIMEOUT` | `ERROR_TYPES.TIMEOUT` | 超时 | 是 |
| `MAX_STEPS` | `ERROR_TYPES.MAX_STEPS` | 推理步数耗尽 | 否 |
| `NETWORK_ERROR` | `ERROR_TYPES.NETWORK_ERROR` | 网络连接失败 | 是 |
| `RATE_LIMIT_ERROR` | `ERROR_TYPES.RATE_LIMIT_ERROR` | API 限流 | 是 |
| `MAX_RETRIES` | `ERROR_TYPES.MAX_RETRIES` | 重试次数耗尽 | 否 |

### 14.2 捕获与处理错误

```typescript
import {
  Agent,
  LQiaoError,
  ERROR_TYPES,
  NetworkError,
  RateLimitError,
  MaxRetriesError,
} from 'lqiao';

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [],
});

try {
  const result = await agent.run('修复代码并提交到 Git');
  console.log(result);
} catch (error) {
  if (error instanceof LQiaoError) {
    switch (error.type) {
      case ERROR_TYPES.MODEL_ERROR:
        // 模型不可用，切换到备用模型
        agent.switchModel('gpt-4o-mini');
        console.log('已切换模型，重试中...');
        break;

      case ERROR_TYPES.SANDBOX_VIOLATION:
        // 沙箱拦截，通常是权限问题
        console.warn('沙箱拦截:', error.message);
        break;

      case ERROR_TYPES.MAX_STEPS:
        // 推理步数不够，可能需要增加 maxSteps
        console.warn('推理步数耗尽，任务未完成');
        break;

      case ERROR_TYPES.NETWORK_ERROR:
        console.error('网络连接失败:', error.message);
        break;

      case ERROR_TYPES.RATE_LIMIT_ERROR:
        console.error('API 限流:', error.message);
        break;

      default:
        console.error('未知错误:', error.type, error.message);
    }
  }
}
```

### 14.3 便捷错误创建函数

```typescript
import {
  createModelError,
  createToolError,
  createSandboxError,
  createNetworkError,
  createRateLimitError,
  createMaxRetriesError,
} from 'lqiao';

// 在你的自定义工具或中间件中使用
function handleApiCall() {
  try {
    // ...
  } catch (e) {
    throw createToolError('API 调用失败', { url: '/api/data' });
  }
}

// 网络错误
throw createNetworkError('连接超时', { host: 'api.example.com' });

// 限流错误
throw createRateLimitError(30, { endpoint: '/v1/chat' }); // 30 秒后重试

// 重试耗尽
throw createMaxRetriesError(originalError, { context: 'model-generate' });
```

---

## 15. 重试策略

### 15.1 内置重试

Agent 自动对以下错误类型进行指数退避重试：
- `MODEL_ERROR`
- `TIMEOUT`
- `NETWORK_ERROR`
- `RATE_LIMIT_ERROR`

```typescript
import { Agent } from 'lqiao';

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [],
  maxRetries: 5, // 最多重试 5 次（默认 3）
});
```

### 15.2 独立使用 withRetry

你可以在任何需要重试的场景使用：

```typescript
import { withRetry } from 'lqiao';

// 基础用法（默认 3 次重试，500ms 基础延迟）
const result = await withRetry(() => fetch('https://api.example.com/data'));

// 自定义配置
const data = await withRetry(
  () => someFlakyApi(),
  {
    maxRetries: 5,    // 最多重试 5 次
    baseDelay: 1000,  // 基础延迟 1 秒
    maxDelay: 60000,  // 最大延迟 60 秒
  },
);
```

**指数退避计算：**
- 第 1 次重试：`500ms × 2^0 = 500ms`
- 第 2 次重试：`500ms × 2^1 = 1000ms`
- 第 3 次重试：`500ms × 2^2 = 2000ms`
- ...上限为 `maxDelay`

---

## 16. 流式输出

### 16.1 使用 Agent.stream()

```typescript
import { Agent } from 'lqiao';

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [],
});

// 流式输出（逐字打印）
for await (const chunk of agent.stream('写一首关于编程的短诗')) {
  process.stdout.write(chunk.text);
}
```

### 16.2 直接使用模型流

```typescript
import { OpenAIModel } from 'lqiao';

const model = new OpenAIModel({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

for await (const chunk of model.stream('解释什么是 AI', {
  maxTokens: 500,
  temperature: 0.7,
})) {
  process.stdout.write(chunk.text);
}
```

### 16.3 注意事项

> **`agent.stream()` 绕过 ReAct 推理循环和工具调用**，仅用于纯模型交互场景。如果需要工具参与，请使用 `agent.run()`。

---

## 17. 实战场景

### 17.1 场景一：代码运维（Bug 修复 + Git 提交）

```typescript
import { Agent, FileTool, GitTool } from 'lqiao';

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool(), new GitTool()],
  sandbox: {
    allowedPaths: [process.cwd()],
    blockedCommands: ['rm -rf'],
  },
  maxSteps: 30,
});

const result = await agent.run(`
  请按以下步骤修复 src/utils.ts 中的 bug：
  1. 读取 src/utils.ts 文件
  2. 定位并修复 bug
  3. 将修复后的内容写回文件
  4. 执行 git add src/utils.ts
  5. 执行 git commit -m "fix: 修复 utils.ts 中的 bug"
  6. 执行 git push
`);

console.log(result);
```

### 17.2 场景二：代码生成（CodeAgent）

```typescript
import { CodeAgent, OpenAIModel } from 'lqiao';

const model = new OpenAIModel({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

const codeAgent = new CodeAgent();

const results = await codeAgent.runWithModel(
  (prompt) => model.generate(prompt),
  '写一个 TypeScript 函数实现二分查找，并用 [1,3,5,7,9] 查找 7 进行测试'
);

for (const result of results) {
  console.log('执行结果:', result);
}
```

### 17.3 场景三：日志分析（多工具协作）

```typescript
import { Agent, FileTool } from 'lqiao';

const agent = new Agent({
  model: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  tools: [new FileTool()],
  sandbox: {
    allowedPaths: [process.cwd(), '/var/log'],
    timeout: 60000,
  },
});

const result = await agent.run(`
  分析 /var/log/app.log 文件：
  1. 读取日志文件
  2. 统计 ERROR 级别的出现次数
  3. 找出出现频率最高的错误类型
  4. 将分析结果写入 analysis-report.md
`);
```

### 17.4 场景四：事件驱动的任务编排

```typescript
import { Agent, FileTool, AGENT_EVENTS } from 'lqiao';

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool()],
});

// 任务开始前记录
agent.on(AGENT_EVENTS.BEFORE_RUN, () => {
  console.time('task');
});

// 监控每次工具调用
agent.on(AGENT_EVENTS.ON_TOOL_CALL, (data) => {
  console.log(`[${Date.now()}] 调用: ${data.tool}`);
});

// 任务完成后报告
agent.on(AGENT_EVENTS.AFTER_RUN, (data) => {
  console.timeEnd('task');
  console.log(`完成 ${data.steps} 步推理`);
});

await agent.run('统计当前目录下所有 .ts 文件的总行数');
```

---

## 18. 高级用法

### 18.1 接入本地模型（Ollama）

```typescript
import { modelRegistry, Agent } from 'lqiao';

// Ollama 已在 ModelRegistry 中预注册，直接通过 ollama/ 前缀使用
const agent = new Agent({
  model: 'ollama/llama3.1',
  apiKey: 'ignored', // Ollama 不需要 API Key
  tools: [],
});

// 数据完全在本地，不经过外部 API
const result = await agent.run('分析这段代码的问题');
```

### 18.2 多 Agent 协作（手动编排）

虽然框架暂不支持原生的多 Agent 协作，但可以手动编排：

```typescript
import { Agent, FileTool, GitTool } from 'lqiao';

// 编码 Agent
const coder = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool()],
  maxSteps: 15,
});

// 运维 Agent
const devops = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new GitTool()],
  maxSteps: 5,
});

// 手动编排流程
const code = await coder.run('修复 src/index.ts 中的空指针异常');
console.log('编码完成:', code);

const deploy = await devops.run('将修改提交到 Git 并推送');
console.log('部署完成:', deploy);
```

### 18.3 工具链组合

```typescript
import {
  Agent,
  FileTool,
  GitTool,
  Sandbox,
  PermissionManager,
  AuditLog,
  Logger,
  Profiler,
} from 'lqiao';

// 完整的企业级配置
const sandbox = new Sandbox({
  allowedPaths: [process.cwd()],
  blockedPaths: ['node_modules', '.git'],
  timeout: 30000,
});

const perms = new PermissionManager();
perms.deny('delete', '生产环境禁止删除');
perms.deny('push:main', '禁止推送主分支');

const audit = new AuditLog();
const logger = new Logger({ verbose: true });
const profiler = new Profiler();

const agent = new Agent({
  model: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  tools: [new FileTool(sandbox), new GitTool(sandbox)],
  sandbox,
  maxSteps: 25,
  maxRetries: 3,
  verbose: true,
});

profiler.start('task');

// 监听所有工具调用并记录审计日志
agent.on('onToolCall', (data) => {
  logger.info(`工具调用: ${data.tool}`, data.args);
});

agent.on('onToolResult', (data) => {
  audit.record({
    tool: data.tool,
    action: 'execute',
    args: data.result,
    success: data.result.success,
    error: data.result.error,
    duration: 0,
  });
});

// 执行任务
const result = await agent.run('读取 package.json 并添加一个新依赖');

const timing = profiler.stop('task');
logger.info('任务完成', { durationMs: timing.duration.toFixed(0) });

// 导出审计日志
console.log(audit.toJSON());
```

### 18.4 自定义模型适配器

如果需要接入框架未支持的模型，继承 `BaseModel` 即可：

```typescript
import { BaseModel, type GenerateOptions, type ModelResponse, type StreamChunk } from 'lqiao';

class MyCustomModel extends BaseModel {
  #client: MyApiClient;

  constructor(config: { apiKey: string; model: string }) {
    super({ provider: 'custom', model: config.model, apiKey: config.apiKey });
    this.#client = new MyApiClient(config.apiKey);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<ModelResponse> {
    const response = await this.#client.chat(prompt, {
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });

    return {
      text: response.text,
      usage: { promptTokens: 0, completionTokens: 0 },
      stopReason: 'stop',
    };
  }

  async *stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk> {
    const stream = this.#client.streamChat(prompt);
    for await (const chunk of stream) {
      yield { text: chunk.text, done: chunk.done };
    }
  }
}

// 注册到模型注册表
import { modelRegistry } from 'lqiao';
modelRegistry.registerProvider('my-model', { provider: 'custom' });
modelRegistry.registerFactory('custom', (cfg) => new MyCustomModel(cfg));
```

### 18.5 Glob 模式匹配工具

```typescript
import { matchesPattern } from 'lqiao';

// 精确匹配
matchesPattern('src/index.ts', 'src/index.ts'); // true

// 单星号：匹配同层任意文件名
matchesPattern('src/utils.ts', 'src/*.ts'); // true
matchesPattern('src/core/agent.ts', 'src/*.ts'); // false

// 双星号：跨层匹配
matchesPattern('src/core/agent.ts', 'src/**/*.ts'); // true
matchesPattern('a/b/c/d.ts', '**/*.ts'); // true
```

---

## 19. 故障排查

### 19.1 模型调用失败

**症状：** `MODEL_ERROR: Failed to fetch`

**排查步骤：**
1. 确认 API Key 是否正确
2. 检查网络连通性
3. 尝试直接调用模型 API 排除框架问题

```typescript
// 直接测试模型连接
import { OpenAIModel } from 'lqiao';
const model = new OpenAIModel({ apiKey: 'YOUR_KEY', model: 'gpt-4o' });
const r = await model.generate('hello');
console.log(r.text);
```

### 19.2 沙箱拦截误报

**症状：** `SANDBOX_VIOLATION: Path outside allowed directories`

**排查步骤：**
1. 确认文件路径是否在 `allowedPaths` 内
2. 检查路径是否为相对路径（沙箱会 resolve 为绝对路径）
3. 临时放宽沙箱配置进行测试

```typescript
const sandbox = new Sandbox({
  allowedPaths: [process.cwd(), '/tmp'],
});
console.log(sandbox.config);
```

### 19.3 ReAct 循环无法得出答案

**症状：** `MAX_STEPS: Exceeded maximum steps (50)`

**排查步骤：**
1. 增加 `maxSteps`（默认 50）
2. 简化任务描述，拆分为多个小任务
3. 检查工具的 `description` 是否清晰（模型依赖描述来判断何时调用）

```typescript
const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [
    new FileTool(),
    // 确保每个工具的 description 清晰
    // new MyTool() — description = "查询用户信息，参数: userId"
  ],
  maxSteps: 100, // 增加最大步数
});
```

### 19.4 代码执行结果为空

**症状：** CodeAgent 返回 `{ success: false, error: 'No code blocks found' }`

**排查步骤：**
1. 确认模型输出包含 fenced code block（```javascript ... ```）
2. 尝试更换模型（某些模型可能不遵守代码块格式要求）
3. 使用 `extractCode()` 方法调试，查看提取结果

```typescript
import { CodeAgent } from 'lqiao';
const codeAgent = new CodeAgent();
console.log(codeAgent.extractCode('some text without code'));
// []

console.log(codeAgent.extractCode('```\nconst x = 1;\n```'));
// [{ language: 'javascript', code: 'const x = 1;' }]
```

### 19.5 TypeScript 编译报错

**症状：** `Cannot find module 'lqiao'`

**排查步骤：**
1. 确认 `package.json` 中 `"type": "module"`（ESM）或移除（CommonJS）
2. 检查 `tsconfig.json` 中 `"moduleResolution": "bundler"` 或 `"node"`
3. 确认构建产物存在：`ls dist/esm/` 和 `ls dist/cjs/`

### 19.6 Git 工具在 Windows 上报错

**症状：** Git 操作失败

**说明：** Git 工具基于 `simple-git`，已处理跨平台兼容。如仍有问题：
1. 确认系统中已安装 `git` 命令
2. 检查 `git --version` 是否正常
3. 指定工作目录：`new GitTool(sandbox, 'C:\\my\\project')`

### 19.7 MCP 连接超时

**症状：** MCPClient connect 失败或长时间无响应

**排查步骤：**
1. 确认 `command` 和 `args` 是否正确（可手动执行验证）
2. SSE 传输需要 `sseUrl` 参数，stdio 不需要
3. 增加 `timeout` 配置（默认 30s）
4. 检查 MCP Server 是否遵循 JSON-RPC 2.0 协议
