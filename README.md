# LQiao / 灵桥

A lightweight, embeddable AI agent framework for TypeScript/JavaScript projects.

## Features

- **ReAct Agent** — Thought → Action → Observation reasoning loop
- **CodeAgent** — Code extraction and sandboxed execution
- **Built-in Tools** — File (read/write/delete), Git (add/commit/push)
- **Model Adapters** — OpenAI (GPT-3.5/4/4o), Anthropic (Claude 3.x)
- **Sandbox Security** — File path restriction + VM code isolation
- **Event System** — Wildcard-pattern event bus for observability
- **Structured Logging** — JSON logs with levels and performance profiling
- **Tiny** — ~7.5KB gzip, ~2ms cold start, zero `any` types

## Installation

```bash
npm install lqiao
# or
bun add lqiao
```

## Quick Start

```typescript
import { Agent, FileTool, GitTool, Sandbox } from 'lqiao';

const agent = new Agent({
  model: 'claude-3.7',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  tools: [new FileTool(), new GitTool()],
  sandbox: true,
  maxSteps: 50,
  maxRetries: 3,
});

const result = await agent.run('Read package.json and summarize its dependencies');
console.log(result);
```

## 使用示例

### 示例一：代码运维智能体 — 自动定位 Bug、修复并提交

**场景**：你发现 `src/server.ts` 有个 bug——请求未捕获异常导致服务崩溃。让 Agent 自动读取文件、定位问题、修复代码，并完成 git add/commit/push 全流程。

```typescript
import { Agent, FileTool, GitTool, Sandbox, Logger } from 'lqiao';

// 1. 配置日志器，开启 verbose 观察 Agent 推理过程
const logger = new Logger({ level: 'info', verbose: true });

// 2. 创建沙箱：限制 Agent 只能操作当前项目目录
const sandbox = new Sandbox({
  allowedPaths: [process.cwd()],
  blockedPaths: [process.cwd() + '/node_modules'],
  timeout: 10000,
});

// 3. 初始化 Agent，挂载文件工具和 Git 工具
const agent = new Agent({
  model: 'claude-3.7',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  tools: [new FileTool(sandbox), new GitTool(sandbox)],
  sandbox: true,
  maxSteps: 20,       // 限制最多 20 步，防止无限循环
  maxRetries: 2,      // 模型调用失败时重试 2 次
});

// 4. 监听工具调用，实时输出 Agent 的操作
agent.on('onToolCall', (data) => {
  console.log(`🔧 调用工具: ${data.tool}`, data.args);
});
agent.on('onStep', (data) => {
  console.log(`💡 第 ${data.step + 1} 步推理完成`);
});

// 5. 下达自然语言任务
const result = await agent.run(`
  1. 读取 src/server.ts 文件内容
  2. 定位未捕获异常的位置（通常在 async 请求处理中缺少 try/catch）
  3. 修复代码：添加全局错误处理器，确保 500 状态码响应
  4. 将修复后的文件写回 src/server.ts
  5. 执行 git add src/server.ts
  6. 执行 git commit -m "fix: 添加全局错误处理器，防止未捕获异常导致服务崩溃"
`);

console.log('✅ 任务完成:', result);
```

**执行流程拆解**：

```
Step 1 → Agent 调用 FileTool("read", "src/server.ts") 读取源码
Step 2 → Agent 分析代码，发现 app.get('/api/data') 缺少 try/catch
Step 3 → Agent 调用 FileTool("write", "src/server.ts", 修复后的代码) 写入修改
Step 4 → Agent 调用 GitTool("add", "src/server.ts") 暂存文件
Step 5 → Agent 调用 GitTool("commit", "fix: ...") 提交更改
Step 6 → Agent 返回 Final Answer，任务结束
```

---

### 示例二：Node.js 日志分析自动化 — 读取日志、统计错误、生成报告

**场景**：生产环境产生了大量日志，需要自动统计错误类型分布、高频错误消息，并生成分析报告。

```typescript
import { Agent, FileTool, Sandbox, DefaultEventBus, AGENT_EVENTS, Logger } from 'lqiao';

// 创建事件总线，记录所有 Agent 操作到审计日志
const eventBus = new DefaultEventBus();
const auditLog: Array<{ event: string; time: number }> = [];

eventBus.on('**', (data) => {
  auditLog.push({ event: 'agent_action', time: Date.now() });
});

// 初始化 Agent（只需要文件工具）
const sandbox = new Sandbox({
  allowedPaths: [process.cwd(), '/var/log/app'],
});

const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool(sandbox)],
  eventBus,
  maxSteps: 15,
});

// 用自然语言描述分析需求
const report = await agent.run(`
  1. 读取 /var/log/app/app.log 文件
  2. 统计所有 ERROR 级别的日志条目
  3. 按错误类型分类：找出出现频率最高的 3 种错误
  4. 将分析报告写入 reports/error-analysis.md，格式如下：
     # 错误分析报告
     ## 错误总览
     - 总错误数：XX
     - 最高频错误：XXX（出现 XX 次）
     ## 详细分类
     （表格列出每种错误的出现次数和占比）
  5. 读取生成的报告并返回完整内容
`);

console.log(report);
console.log(`\n📊 共记录 ${auditLog.length} 次 Agent 操作`);
```

**为什么用 Agent 而不是直接写脚本**：

| 方式 | 优势 | 劣势 |
|------|------|------|
| 写脚本 | 执行快、确定性高 | 每次日志格式变化都要改脚本 |
| 用 Agent | 理解语义，自动分类，生成结构化报告 | 成本较高（模型 API 调用） |

适合**日志格式不固定**、需要**语义理解**的场景。

---

### 示例三：前端工程助手 — 代码生成 + ESLint 修复 + 构建辅助

**场景**：在 React 项目中，让 Agent 生成一个新组件、修复 ESLint 错误、安装依赖。

```typescript
import { Agent, CodeAgent, FileTool, Sandbox, Logger, Profiler } from 'lqiao';

const logger = new Logger({ level: 'info' });
const profiler = new Profiler();

// 沙箱限制：只允许操作 src/ 目录
const sandbox = new Sandbox({
  allowedPaths: [process.cwd() + '/src'],
  blockedPaths: [process.cwd() + '/src/.env'],
  timeout: 15000,
});

// 创建代码执行 Agent，用于运行生成的代码做验证
const codeAgent = new CodeAgent(new Sandbox({ timeout: 5000 }));

// 创建主 Agent
const agent = new Agent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [new FileTool(sandbox)],
  sandbox: true,
  maxSteps: 10,
});

// 性能分析：记录任务总耗时
profiler.start('component-generation');

// 任务 1：生成 TypeScript 组件
const task1 = await agent.run(`
  在 src/components/ 目录下创建一个 UserCard.tsx 组件：
  1. 组件接收 props：{ name: string; email: string; avatar?: string }
  2. 使用函数式组件 + TypeScript 接口定义
  3. 如果 avatar 未提供，使用首字母作为默认头像占位符
  4. 组件样式使用 CSS-in-JS（内联 style）
  5. 导出为默认 export
`);

logger.info('组件生成完成', { result: task1 });

// 任务 2：验证生成的代码可执行性
const verification = await codeAgent.executeCode(`
  // 模拟组件 props 类型检查
  const props = { name: "张三", email: "zhangsan@example.com" };
  return { valid: true, props };
`);

if (verification.success) {
  logger.info('代码验证通过', { output: verification.output });
}

// 任务 3：生成使用示例
const task3 = await agent.run(`
  1. 读取 src/components/UserCard.tsx
  2. 在 src/stories/UserCard.stories.tsx 中生成 Storybook 使用示例
  3. 包含 3 个 story：默认状态、无头像状态、长文本溢出状态
  4. 写入文件
`);

const timing = profiler.stop('component-generation');
logger.info('全部任务完成', { durationMs: timing.duration.toFixed(0) });
```

**本示例展示了**：

- **Sandbox** 路径白名单 + 黑名单组合使用，精细控制 Agent 可操作范围
- **CodeAgent** 独立于主 Agent 执行代码验证，两者共享但可独立配置沙箱
- **Logger + Profiler** 组合实现可观测性：结构化日志 + 性能计时
- 多个 Agent 协作：主 Agent 负责文件操作，CodeAgent 负责代码验证

## API Reference

### Agent

```typescript
const agent = new Agent({
  model: 'gpt-4o',              // or 'claude-3.7', etc.
  apiKey: 'sk-...',
  tools: [new FileTool()],      // optional
  sandbox: true,                // or SandboxConfig object
  maxSteps: 50,                 // max reasoning steps
  maxRetries: 3,                // retry attempts on transient errors
  verbose: false,               // debug logging
});

// Run a natural language task
const result = await agent.run('Fix the bug in src/index.ts');

// Stream the reasoning process
for await (const chunk of agent.stream('Analyze this code')) {
  process.stdout.write(chunk.text);
}

// Listen to events
agent.on('onToolCall', (data) => console.log('Tool:', data));
agent.on('onError', (data) => console.error('Error:', data));

// Switch model at runtime
agent.switchModel('gpt-4o', 'new-api-key');
```

### ReAct Agent (Direct Access)

```typescript
import { ReactAgent, FileTool } from 'lqiao';

const agent = new ReactAgent({
  tools: [new FileTool()],
  maxSteps: 10,
});

const answer = await agent.run(
  (prompt) => model.generate(prompt),  // your model function
  'What files are in the current directory?',
);
```

### CodeAgent

```typescript
import { CodeAgent, Sandbox } from 'lqiao';

const codeAgent = new CodeAgent(new Sandbox({
  allowedPaths: [process.cwd()],
  timeout: 5000,
}));

// Execute code directly
const result = await codeAgent.executeCode('return Math.PI * 2;');

// Extract and execute code from LLM response
const results = await codeAgent.executeFromResponse(llmOutput);

// Full pipeline: generate → extract → execute
const results = await codeAgent.runWithModel(
  (prompt) => model.generate(prompt),
  'Calculate the factorial of 10',
);
```

### Custom Tools

```typescript
import { ToolBase } from 'lqiao';

class WeatherTool extends ToolBase {
  name = 'weather';
  description = 'Get current weather for a city';

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

### Event Bus

```typescript
import { DefaultEventBus, AGENT_EVENTS } from 'lqiao';

const bus = new DefaultEventBus();

// Listen to specific events
bus.on(AGENT_EVENTS.ON_TOOL_CALL, (data) => {
  console.log(`Tool "${data.tool}" called with:`, data.args);
});

// Wildcard: listen to all events
bus.on('**', (data) => {
  auditLog.push(data);
});

// One-time listener
bus.once('onError', (data) => {
  sendAlert(data.error);
});
```

### Security

```typescript
import { Sandbox, PermissionManager, AuditLog } from 'lqiao';

// File sandbox
const sandbox = new Sandbox({
  allowedPaths: ['/app/workspace'],
  blockedPaths: ['/app/secrets'],
  timeout: 10000,
});

// Permission rules
const permissions = new PermissionManager();
permissions.deny('git:push', 'No pushing to remote');
permissions.deny('file:delete*');

// Audit log
const audit = new AuditLog();
audit.record({ tool: 'file', action: 'read', args: { path: 'x.txt' }, success: true, duration: 5 });
console.log(audit.toJSON());  // Export as JSON
```

### Logging & Profiling

```typescript
import { Logger, Profiler } from 'lqiao';

const logger = new Logger({ level: 'info' });
logger.info('Agent started', { model: 'gpt-4o' });

// Enable verbose mode for debug output
logger.verbose();

const profiler = new Profiler();
profiler.start('model-call');
await model.generate('Hello');
const timing = profiler.stop('model-call');
console.log(`Took ${timing.duration.toFixed(1)}ms`);
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Security Layer                  │
│   Sandbox │ Permissions │ Audit         │
├─────────────────────────────────────────┤
│         Agent Layer                     │
│   Agent │ ReactAgent │ CodeAgent        │
├─────────────────────────────────────────┤
│         Tool Layer                      │
│   FileTool │ GitTool │ Custom Tools     │
├─────────────────────────────────────────┤
│         Model Layer                     │
│   OpenAI │ Anthropic │ Registry         │
└─────────────────────────────────────────┘
              ↕ Event Bus ↕
```

See [docs/architecture.md](docs/architecture.md) for detailed design decisions.

## Error Handling

```typescript
import { Agent, LQiaoError, ERROR_TYPES } from 'lqiao';

try {
  await agent.run('Do something');
} catch (error) {
  if (error instanceof LQiaoError) {
    switch (error.type) {
      case ERROR_TYPES.MODEL_ERROR:
        console.error('Model API failed:', error.message);
        break;
      case ERROR_TYPES.MAX_STEPS:
        console.error('Agent exceeded reasoning steps');
        break;
      case ERROR_TYPES.SANDBOX_VIOLATION:
        console.error('Security violation:', error.message);
        break;
    }
  }
}
```

## Performance

| Metric | Target | Current |
|--------|--------|---------|
| Cold start | < 100ms | ~2ms |
| Bundle size | < 50KB gzip | ~7.5KB gzip |
| TypeScript | zero `any` | Achieved |
| Test coverage | > 85% lines | 140 tests |

## License

MIT
