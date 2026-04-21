# Contributing to LQiao / 灵桥

## Development Setup

```bash
# Install dependencies
bun install

# Run type check, tests, and build
bun run check

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Build
bun run build

# Type check only
bun run typecheck
```

## Project Structure

```
src/
├── core/        # Agent, ReAct, CodeAgent, EventBus
├── model/       # Model adapters (OpenAI, Anthropic)
├── tools/       # Built-in tools (File, Git)
├── security/    # Sandbox, Permissions, Audit
├── logger/      # Structured logging, profiling
├── errors/      # Error classes and factories
├── types/       # Public type definitions
└── utils/       # Utility functions (retry, format)
```

## Adding a New Tool

1. Extend `ToolBase` from `src/tools/base.ts`
2. Implement `name`, `description`, and `doExecute()`
3. Register via `ToolRegistry` or pass directly to `Agent`

```typescript
import { ToolBase } from 'lqiao';

class MyTool extends ToolBase {
  name = 'my-tool';
  description = 'Does something useful';

  protected async doExecute(...args: unknown[]) {
    return { success: true, data: 'result' };
  }
}
```

## Adding a Model Adapter

1. Extend `BaseModel` from `src/model/base.ts`
2. Implement `generate()` and `stream()`
3. Register factory in `modelRegistry`

## Testing

- Unit tests go in `tests/unit/` matching the `src/` structure
- Integration tests go in `tests/integration/`
- Run `bun run test --coverage` for coverage report
- Target: lines > 85%, branches > 75%

## Pull Requests

- All PRs must pass `bun run check` (typecheck + test)
- New features require tests
- Breaking changes require documentation in CHANGELOG.md
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)

## Branch Strategy

- `main` — stable release branch
- `phase-X` — development branches per phase
- `feat/*` — feature branches within a phase
- All merges use squash merge to keep `main` history clean
