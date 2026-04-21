# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Agent main class with `run()` and `stream()` methods
- ReAct Agent with Thought/Action/Observation reasoning loop
- CodeAgent with code block extraction and sandboxed execution
- OpenAI model adapter (GPT-3.5/4/4o/o1/o3) with streaming
- Anthropic Claude adapter (Claude 3.x) with streaming
- File tool (read/write/delete) with sandbox integration
- Git tool (add/commit/push) via simple-git
- Event bus with wildcard pattern matching (`*`, `**`)
- Permission manager with configurable deny/allow rules
- Audit log with JSON export and filtering
- Structured logger with level-based filtering and verbose mode
- Performance profiler with timing metrics
- Sandbox for file path restriction and VM code isolation
- Model registry with automatic provider matching
- Tool registry with register/remove operations
- Retry utility with exponential backoff
- TypeScript strict mode, zero `any` escapes
- ESM + CJS dual module output
- 79 unit tests across 12 test files
