# LQiao / 灵桥 — Architecture Design

## Overview

LQiao is a lightweight TypeScript AI agent framework with a layered, event-driven architecture. Each layer is decoupled and communicates through an event bus, enabling independent development and testing.

## Layer Diagram

```
┌─────────────────────────────────────────────┐
│           Security Layer                     │
│  Sandbox  │  Permissions  │  Audit Log       │
├─────────────────────────────────────────────┤
│           Agent Layer                        │
│  Agent  │  ReactAgent  │  CodeAgent          │
├─────────────────────────────────────────────┤
│           Tool Layer                         │
│  FileTool  │  GitTool  │  Custom Tools       │
├─────────────────────────────────────────────┤
│           Model Layer                        │
│  OpenAI  │  Anthropic  │  Registry           │
└─────────────────────────────────────────────┘
              ↕ Event Bus ↕
```

## Module Dependency Graph

```
Agent ──┬── ReactAgent ──┬── Tools
        │                ├── Model
        │                └── Sandbox
        │
        ├── CodeAgent ─── Sandbox
        │
        ├── EventBus (shared)
        │
        └── Logger / Profiler (observability)
```

## Core Design Decisions

### 1. No `import type` for modules with only type exports

Vite/vitest ESM resolution skips modules that have no runtime exports. We avoid `import type` when the module might be the only import from a file, preferring regular imports that include at least one runtime value.

### 2. Shared Sandbox

CodeAgent and ReAct Agent share the same `Sandbox` instance. This avoids maintaining two separate isolation systems and ensures consistent security guarantees.

### 3. Event-Driven Architecture

All significant operations emit events through a shared `EventBus`:
- `beforeRun` / `afterRun` — Agent lifecycle
- `onStep` — Each reasoning step
- `onToolCall` / `onToolResult` — Tool invocation
- `onError` — Error conditions

External code can observe and react to agent behavior without modifying the core.

### 4. Error Classification

All errors use `LQiaoError` with a discriminated `type` field:
- `MODEL_ERROR` — API failures, rate limits
- `TOOL_ERROR` — Tool execution failures
- `SANDBOX_VIOLATION` — Security boundary violations
- `TIMEOUT` — Execution time exceeded
- `MAX_STEPS` — Reasoning loop exhausted

Consumers check `error.type` for branching logic rather than `instanceof`.

### 5. Model Registry Pattern

Models are resolved by string prefix matching (e.g., `gpt-4o` → `openai` provider). New providers are registered via `modelRegistry.registerProvider(prefix, config)` and `modelRegistry.registerFactory(provider, factory)`.

### 6. Minimal Dependencies

The framework only depends on:
- `openai` — Official OpenAI SDK
- `@anthropic-ai/sdk` — Official Anthropic SDK
- `simple-git` — Cross-platform Git operations

All other functionality is implemented from scratch.

## Security Model

### File Sandboxing
- Whitelist-based: only files under `allowedPaths` are accessible
- Blacklist supplement: specific paths can be explicitly blocked
- Path normalization prevents `../` escape attacks

### Code Sandboxing
- Node.js `vm` module with restricted context
- `require`, `process`, `module`, `global` set to `undefined`
- Execution timeout prevents infinite loops

### Permission Control
- Pattern-based rule matching (supports `*` wildcards)
- Pre-configured deny rules for dangerous operations
- Audit trail for all tool invocations

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Cold start | < 100ms | ~2ms |
| Bundle size | < 50KB gzip | ~7.5KB gzip |
| Test coverage | lines > 85% | TBD |
| TypeScript | zero `any` | Achieved |
