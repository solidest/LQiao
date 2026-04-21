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
| Test coverage | > 85% lines | 79 tests |

## License

MIT
