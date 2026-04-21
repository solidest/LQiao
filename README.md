# LQiao / 灵桥

轻量、可嵌入、企业级 TypeScript AI 智能体框架。

## 功能特性

- **ReAct Agent** — Thought → Action → Observation 推理循环
- **CodeAgent** — 代码提取 + 沙箱执行验证
- **内置工具** — File (read/write/delete)、Git (add/commit/push)
- **MCP 客户端** — Stdio/SSE 传输、远程工具发现、自动适配为内部 Tool
- **五大模型适配器** — OpenAI (GPT)、Anthropic (Claude)、通义千问 (DashScope)、DeepSeek、Ollama
- **Skill 技能系统** — 运行时加载/启用/禁用/移除，工具热替换
- **沙箱安全** — 文件路径白名单/黑名单 + VM 代码隔离 + 权限规则
- **审计日志** — 工具调用记录、过滤、JSON 导出
- **事件系统** — 通配符事件总线，全链路可观测
- **结构化日志** — JSON 日志 + 性能分析器 (Profiler)
- **小巧** — ~44KB ESM，~2ms 冷启动，零 `any` 类型

## 安装

```bash
bun add lqiao
# 或
npm install lqiao
```

## 快速开始

```typescript
import { Agent, FileTool, GitTool, Sandbox } from 'lqiao';

const agent = new Agent({
  model: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  tools: [new FileTool(), new GitTool()],
  sandbox: true,
  maxSteps: 50,
  maxRetries: 3,
});

const result = await agent.run('读取 package.json 并总结其依赖');
console.log(result);
```

## 使用示例与教程

完整教程文档：[out/TUTORIAL.md](out/TUTORIAL.md)

`out/` 目录下提供了 7 个可运行的示例程序（`node out/XX-xxx.cjs` 直接执行），覆盖框架全部功能：

| 示例 | 文件 | 覆盖功能 |
|------|------|---------|
| 一：代码运维智能体 | [out/01-code-ops-agent.cjs](out/01-code-ops-agent.cjs) | CodeAgent + FileTool + GitTool + ReAct 循环 + 沙箱 |
| 二：日志分析智能体 | [out/02-log-analysis-agent.cjs](out/02-log-analysis-agent.cjs) | ReAct Agent + 文件读写 + 事件总线 + 错误报告生成 |
| 三：前端工程助手 | [out/03-frontend-assistant.cjs](out/03-frontend-assistant.cjs) | Agent + CodeAgent 验证 + FileTool + Storybook 生成 |
| 四：多模型适配 | [out/04-model-adapters-showcase.cjs](out/04-model-adapters-showcase.cjs) | 5 大模型 Provider (OpenAI/Anthropic/DashScope/DeepSeek/Ollama) + 流式输出 + ModelRegistry + 错误类型 + withRetry |
| 五：Skill 热更新 | [out/05-skills-hotswap.cjs](out/05-skills-hotswap.cjs) | Skill add/remove/enable/disable + Tool add/replace/remove + updateConfig + switchModel + clearTools |
| 六：MCP 协议客户端 | [out/06-mcp-client-integration.cjs](out/06-mcp-client-integration.cjs) | MCPClient Stdio 连接 + 工具发现 + MCPToolAdapter 适配 + ReactAgent 集成 |
| 七：审计日志与分析器 | [out/07-audit-profiler.cjs](out/07-audit-profiler.cjs) | AuditLog 记录/过滤/导出 + Logger 结构化日志 + Profiler 性能分析 + 错误类型 + Glob 匹配 |

## API Reference

### Agent

```typescript
const agent = new Agent({
  model: 'gpt-4o',              // 或 'claude-sonnet-4-6', 'qwen-max', 'deepseek-chat', 'ollama/llama3.1'
  apiKey: 'sk-...',
  tools: [new FileTool()],      // 可选
  sandbox: true,                // 或 SandboxConfig 对象
  maxSteps: 50,                 // 最大推理步数
  maxRetries: 3,                // 模型调用失败重试次数
  verbose: false,               // 详细日志
  mcpServers: [...],            // 可选，MCP 服务器配置
  skills: [...],                // 可选，初始技能
});

// 执行自然语言任务
const result = await agent.run('修复 src/index.ts 中的 bug');

// 流式输出（绕过 ReAct 循环，仅返回模型原始输出）
for await (const chunk of agent.stream('分析这段代码')) {
  process.stdout.write(chunk.text);
}

// 事件监听
agent.on('onToolCall', (data) => console.log('Tool:', data));
agent.on('onError', (data) => console.error('Error:', data));

// 运行时切换模型
agent.switchModel('gpt-4o', 'new-api-key');

// 技能管理
agent.addSkill(skillConfig);
agent.removeSkill('log-analyzer');
agent.enableSkill('log-analyzer');
agent.disableSkill('log-analyzer');
agent.getSkills();

// 工具管理
agent.addTool(new GitTool(sandbox));
agent.removeTool('git');

// 配置更新
agent.updateConfig({ maxSteps: 30, maxRetries: 5 });
agent.updateSandbox(new Sandbox({ allowedPaths: ['/tmp'] }));

// 清空
agent.clearTools();
agent.disconnectMCP();
```

### ReAct Agent（直接使用）

```typescript
import { ReactAgent, FileTool } from 'lqiao';

const agent = new ReactAgent({
  tools: [new FileTool()],
  maxSteps: 10,
});

const answer = await agent.run(
  (prompt) => model.generate(prompt),  // 你的模型函数
  '当前目录有哪些文件？',
);
```

### CodeAgent

```typescript
import { CodeAgent, Sandbox } from 'lqiao';

const codeAgent = new CodeAgent(new Sandbox({
  allowedPaths: [process.cwd()],
  timeout: 5000,
}));

// 直接执行代码
const result = await codeAgent.executeCode('return Math.PI * 2;');

// 从 LLM 响应中提取并执行代码块
const results = await codeAgent.executeFromResponse(llmOutput);

// 完整流程：生成 → 提取 → 执行
const results = await codeAgent.runWithModel(
  (prompt) => model.generate(prompt),
  '计算 10 的阶乘',
);
```

### 自定义工具

```typescript
import { ToolBase } from 'lqiao';

class WeatherTool extends ToolBase {
  name = 'weather';
  description = '获取城市当前天气';

  protected async doExecute(city: string) {
    const response = await fetch(`https://api.weather/${city}`);
    const data = await response.json();
    return { success: true, data };
  }
}

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: '...',
  tools: [new WeatherTool()],
});
```

### MCP 客户端（远程工具）

```typescript
import { Agent, MCPClient, wrapMCPTools, FileTool } from 'lqiao';

// 方式一：Agent 自动初始化（通过 mcpServers 配置）
const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool()],
  mcpServers: [
    {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      // transport: 'stdio',  // 默认
      // timeout: 30000,      // 连接超时
    },
  ],
});
// MCP 工具在 agent.run() 时自动发现并可用

// 方式二：手动管理 MCP 生命周期
const client = new MCPClient({
  name: 'echo-server',
  transport: 'stdio',
  command: 'node',
  args: ['echo-server.cjs'],
  timeout: 10000,
});

await client.connect();

// 直接调用
const result = await client.callTool('echo', { message: 'Hello' });

// 适配为内部 Tool 接口
const adaptedTools = wrapMCPTools(client);
agent.addTool(adaptedTools[0]);

await client.disconnect();
```

MCP 工具对 Agent 完全透明，行为与本地工具（FileTool、GitTool）完全一致。

### 事件总线

```typescript
import { DefaultEventBus, AGENT_EVENTS } from 'lqiao';

const bus = new DefaultEventBus();

// 监听特定事件
bus.on(AGENT_EVENTS.ON_TOOL_CALL, (data) => {
  console.log(`工具 "${data.tool}" 被调用:`, data.args);
});

// 通配符：监听所有事件
bus.on('**', (data) => {
  auditLog.push(data);
});

// 一次性监听
bus.once('onError', (data) => {
  sendAlert(data.error);
});
```

### 安全

```typescript
import { Sandbox, PermissionManager, AuditLog } from 'lqiao';

// 文件沙箱
const sandbox = new Sandbox({
  allowedPaths: ['/app/workspace'],
  blockedPaths: ['/app/secrets'],
  timeout: 10000,
});

// 权限规则
const permissions = new PermissionManager();
permissions.deny('git:push', '不允许推送到远程');
permissions.deny('file:delete*');

// 检查操作是否允许
permissions.check('git:push'); // 抛出 SANDBOX_VIOLATION

// 审计日志
const audit = new AuditLog();
audit.record({
  tool: 'file',
  action: 'read',
  args: { path: 'x.txt' },
  success: true,
  duration: 5,
});

console.log(audit.size);               // 1
console.log(audit.filterByTool('file')); // 过滤
console.log(audit.toJSON());           // JSON 导出
```

### 日志与性能

```typescript
import { Logger, Profiler } from 'lqiao';

const logger = new Logger({ level: 'info', verbose: false });
logger.info('Agent 启动', { model: 'gpt-4o' });
logger.warn('慢查询检测', { duration: 3500 });
logger.error('远程拒绝', { tool: 'git', action: 'push' });

// 详细模式：输出 JSON 格式日志
logger.verbose();

const profiler = new Profiler();
profiler.start('model-call');
await model.generate('Hello');
const timing = profiler.stop('model-call');
console.log(`耗时 ${timing.duration.toFixed(1)}ms`);

// 统计
console.log(profiler.average('model-call'));
console.log(profiler.max('model-call'));
console.log(profiler.getRecords());
```

## 架构

```
┌─────────────────────────────────────────┐
│         安全层 Security Layer           │
│   Sandbox │ Permissions │ Audit         │
├─────────────────────────────────────────┤
│         Agent 层 Agent Layer            │
│   Agent │ ReactAgent │ CodeAgent        │
│   SkillRegistry │ SkillLoader            │
├─────────────────────────────────────────┤
│         工具层 Tool Layer               │
│   FileTool │ GitTool │ MCP Client       │
│   └── 远程工具（自动发现适配）           │
├─────────────────────────────────────────┤
│         模型层 Model Layer              │
│   OpenAI │ Anthropic │ DashScope        │
│   DeepSeek │ Ollama │ Registry          │
└─────────────────────────────────────────┘
              ↕ Event Bus ↕
```

详见 [docs/architecture.md](docs/architecture.md)。

## 错误处理

```typescript
import { Agent, LQiaoError, ERROR_TYPES } from 'lqiao';

try {
  await agent.run('执行某个任务');
} catch (error) {
  if (error instanceof LQiaoError) {
    switch (error.type) {
      case ERROR_TYPES.MODEL_ERROR:
        console.error('模型 API 失败:', error.message);
        break;
      case ERROR_TYPES.TOOL_ERROR:
        console.error('工具执行失败:', error.message);
        break;
      case ERROR_TYPES.SANDBOX_VIOLATION:
        console.error('安全违规:', error.message);
        break;
      case ERROR_TYPES.NETWORK_ERROR:
        console.error('网络连接失败:', error.message);
        break;
      case ERROR_TYPES.RATE_LIMIT_ERROR:
        console.error('API 限流:', error.message);
        break;
      case ERROR_TYPES.MAX_RETRIES:
        console.error('重试耗尽:', error.message);
        break;
      case ERROR_TYPES.MAX_STEPS:
        console.error('Agent 推理步数超限');
        break;
    }
  }
}
```

## 内置工具

| 工具 | 操作 | 说明 |
|------|------|------|
| FileTool | read / write / delete | 文件读写，受沙箱路径限制 |
| GitTool | add / commit / push | Git 操作，支持自定义 author/remote/branch |
| MCPToolAdapter | 任意 | 将 MCP 远程工具适配为内部 Tool 接口 |
| 自定义 | 任意 | 继承 ToolBase，实现 doExecute 方法 |

## 支持的模型

| Provider | 模型 ID 示例 | 基座 |
|----------|-------------|------|
| OpenAI | `gpt-4o`, `gpt-3.5-turbo` | OpenAI API |
| Anthropic | `claude-sonnet-4-6`, `claude-3.7` | Anthropic API |
| DashScope | `qwen-max`, `qwen-plus` | 阿里云通义千问 |
| DeepSeek | `deepseek-chat` | DeepSeek API |
| Ollama | `llama3.1`, `qwen2.5` | 本地 Ollama 服务 |

ModelRegistry 内置了常用 provider 的 baseUrl 自动解析，也支持 `registerProvider()` 注册自定义 provider。

## 性能指标

| 指标 | 目标 | 当前值 |
|------|------|--------|
| 冷启动 | < 100ms | ~80ms |
| 包体积 | < 50KB gzip | ~44KB ESM |
| TypeScript | 零 `any` | 已达成 |
| 测试覆盖 | > 85% lines | 271 tests, 33 files, 91% lines |

## 许可证

MIT
