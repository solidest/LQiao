# LQiao / 灵桥 — AI Agent Framework (TypeScript)

> Lightweight, embeddable, enterprise-ready AI agent framework for TS/JS ecosystems.

## Project State

**Branch:** `docs` — documentation and planning phase. No source code yet (`src/` does not exist).
**Target:** `main` branch for releases.
**PRD:** [docs/PRD.md](docs/PRD.md) | **R&D Plan:** [docs/R&D_PLAN.md](docs/R&D_PLAN.md)

## Architecture (4-layer, event-driven)

```
Security Layer   — Sandbox, permissions, audit
Agent Layer      — ReAct Agent, CodeAgent, multi-agent协作
Tool Layer       — Git, File, MCP, custom tools
Model Layer      — GPT, Claude, 通义, DeepSeek, Ollama
```

All layers are decoupled. Each layer communicates via an event bus.

## Key Technical Decisions

### Build & Tooling

| Tool | Choice |
|------|--------|
| Runtime | Node.js |
| Language | TypeScript (strict mode) |
| Build | Rollup — ESM + CJS dual output |
| Test | Vitest |
| Lint | ESLint + Prettier |
| Package Manager | bun (see `.claude/settings.local.json`) |

### Module Structure (planned)

```
src/
├── index.ts                 # Main entry — re-exports all public APIs
├── types/                   # agent.ts, tool.ts, model.ts, event.ts, error.ts
├── core/                    # agent.ts, react-agent.ts, code-agent.ts, event-bus.ts
├── model/                   # base.ts, openai.ts, anthropic.ts, registry.ts
├── tools/                   # base.ts, git-tool.ts, file-tool.ts, registry.ts
├── security/                # sandbox.ts, permissions.ts, audit.ts
├── errors/                  # base.ts + per-domain error classes
├── logger/                  # logger.ts, profiler.ts
└── utils/                   # retry.ts, format.ts
```

### Core Interfaces (from R&D_PLAN)

```typescript
interface AgentConfig {
  model: string | ModelProvider;
  apiKey?: string;
  tools?: Tool[];
  sandbox?: boolean | SandboxConfig;
  maxSteps?: number;       // default 50
  maxRetries?: number;     // default 3
  verbose?: boolean;
}

interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute(...args: unknown[]): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

abstract class BaseModel {
  abstract generate(prompt: string, options?: GenerateOptions): Promise<ModelResponse>;
  abstract stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk>;
}
```

## P0 Features (MVP) — Must Implement First

1. **ReAct Agent** — Thought → Action → Observation loop, multi-step, retry
2. **CodeAgent** — Code extraction + execution
3. **Git Tool** — add / commit / push
4. **File Tool** — read / write / delete
5. **Model Adapters** — GPT + Claude, streaming
6. **Sandbox** — path-restricted file ops, VM code isolation
7. **ESM + CJS** — dual module output

## Non-functional Targets

| Metric | Target |
|--------|--------|
| Cold start | < 100ms |
| Bundle size | < 50KB gzip |
| Core LOC | < 5000 |
| Test coverage | lines > 85%, branches > 75% |
| TypeScript | `--strict`, zero `any` escapes |

## Development Conventions

### Code Style

- **No comments** unless the WHY is non-obvious (hidden constraint, workaround, non-trivial invariant)
- **No error handling** for scenarios that can't happen internally — only validate at system boundaries (user input, external APIs)
- **No premature abstractions** — 3 similar lines is better than a half-finished helper
- **No emoji** in code or docs unless explicitly requested
- **Naming** — PascalCase for classes/interfaces, camelCase for functions/variables, kebab-case for files

### Error Handling

Use domain-specific error classes in `src/errors/`, each with a `type` field:
`'MODEL_ERROR' | 'TOOL_ERROR' | 'SANDBOX_VIOLATION' | 'TIMEOUT' | 'MAX_STEPS'`

Consumers should check `error.type` for fallback logic, not `instanceof`.

### Events

Lifecycle events: `'beforeRun' | 'afterRun' | 'onToolCall' | 'onError' | 'onStep'`
Event bus supports `on()` / `off()` / `emit()` — implement early (Phase 0/1), not deferred.

### Sandbox Strategy

- **MVP (v1.0):** File path restriction + Node.js `vm` module for code isolation
- **v2.x:** Containerized sandbox (deferred)
- CodeAgent and ReAct share the **same** sandbox implementation

## What NOT to Do

- **Don't** introduce LangChain-style heavy abstractions (chains, pipelines, memory stores) — stay minimal
- **Don't** add dependencies without strong justification — every dep is scrutinized for bundle size
- **Don't** defer sandbox to late phases — it's a P0 requirement per PRD, needed alongside CodeAgent
- **Don't** use `any` types — if a type is truly unknown, use `unknown` with narrowing
- **Don't** create documentation files (`.md`) unless explicitly asked

## Current Branch Context

Working on `docs` branch. All current files are documentation only.
When implementation starts, create feature branches off `main`.
