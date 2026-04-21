import { describe, it, expect } from 'vitest';

describe('Benchmark: Cold start', () => {
  it('should import within 300ms', async () => {
    // Force fresh import by using dynamic import
    const start = performance.now();
    await import('../../src/index');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(300);
  });
});

describe('Benchmark: Event bus throughput', () => {
  it('should handle 10000 emits in under 100ms', async () => {
    const { DefaultEventBus } = await import('../../src/core/event-bus');
    const bus = new DefaultEventBus();
    let count = 0;
    bus.on('test', () => count++);
    bus.on('t*', () => count++);

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      bus.emit('test', i);
    }
    const elapsed = performance.now() - start;

    expect(count).toBe(20000);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('Benchmark: Sandbox performance', () => {
  it('should validate 1000 paths in under 50ms', async () => {
    const { Sandbox } = await import('../../src/security/sandbox');
    const sandbox = new Sandbox({ allowedPaths: [process.cwd()] });

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      sandbox.validatePath(`package.json`);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});

describe('Benchmark: Code execution', () => {
  it('should execute simple code in under 10ms', async () => {
    const { CodeAgent } = await import('../../src/core/code-agent');
    const agent = new CodeAgent();

    const start = performance.now();
    await agent.executeCode('return 2 ** 16;');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});
