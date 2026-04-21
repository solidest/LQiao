import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StdioTransport } from '../../../src/mcp/transports/stdio';

const mockProcess = {
  stdin: { write: vi.fn(), end: vi.fn() },
  stdout: { on: vi.fn() },
  kill: vi.fn(),
  on: vi.fn(),
  killed: false,
};

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockProcess),
}));

describe('StdioTransport', () => {
  let transport: StdioTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess.killed = false;
    transport = new StdioTransport();
  });

  afterEach(async () => {
    await transport.disconnect().catch(() => {});
  });

  it('should connect and spawn process', async () => {
    await transport.connect({ command: 'node', args: ['server.js'] });

    const { spawn } = await import('node:child_process');
    expect(spawn).toHaveBeenCalledWith(
      'node',
      ['server.js'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'inherit'] }),
    );
    expect(transport.isConnected).toBe(true);
  });

  it('should send JSON-RPC request via stdin', async () => {
    await transport.connect({ command: 'node', args: [] });

    // Capture the data handler registered on stdout
    let dataHandler: ((chunk: Buffer) => void) | undefined;
    mockProcess.stdout.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'data') dataHandler = handler as (chunk: Buffer) => void;
    });

    // Need to reconnect to capture the handler (mock was cleared)
    await transport.disconnect();
    transport = new StdioTransport();
    await transport.connect({ command: 'node', args: [] });

    const requestPromise = transport.request('tools/list');

    expect(mockProcess.stdin!.write).toHaveBeenCalled();
    const written = (mockProcess.stdin!.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const msg = JSON.parse(written);
    expect(msg.jsonrpc).toBe('2.0');
    expect(msg.method).toBe('tools/list');
    expect(typeof msg.id).toBe('number');

    // Simulate response
    dataHandler!(Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } }) + '\n'));

    const result = await requestPromise;
    expect(result).toEqual({ tools: [] });
  });

  it('should handle JSON-RPC error responses', async () => {
    await transport.disconnect();
    transport = new StdioTransport();

    let dataHandler: ((chunk: Buffer) => void) | undefined;
    mockProcess.stdout.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'data') dataHandler = handler as (chunk: Buffer) => void;
    });

    await transport.connect({ command: 'node', args: [] });

    const requestPromise = transport.request('tools/call', { name: 'x' });

    // Wait for write to be called
    await vi.waitFor(() => mockProcess.stdin!.write.mock.calls.length > 0, { timeout: 1000 });
    const written = (mockProcess.stdin!.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const msg = JSON.parse(written);

    dataHandler!(Buffer.from(JSON.stringify({
      jsonrpc: '2.0',
      id: msg.id,
      error: { message: 'Tool not found' },
    }) + '\n'));

    await expect(requestPromise).rejects.toThrow('Tool not found');
  });

  it('should handle non-JSON lines in output', async () => {
    await transport.disconnect();
    transport = new StdioTransport();

    let dataHandler: ((chunk: Buffer) => void) | undefined;
    mockProcess.stdout.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'data') dataHandler = handler as (chunk: Buffer) => void;
    });

    await transport.connect({ command: 'node', args: [] });

    const requestPromise = transport.request('tools/list');

    await vi.waitFor(() => mockProcess.stdin!.write.mock.calls.length > 0, { timeout: 1000 });
    const written = (mockProcess.stdin!.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const msg = JSON.parse(written);

    // Mixed stderr-like output before the JSON response
    dataHandler!(Buffer.from('some debug output\n'));
    dataHandler!(Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'ok' }) + '\n'));

    const result = await requestPromise;
    expect(result).toBe('ok');
  });

  it('should timeout on slow responses', async () => {
    await transport.disconnect();
    transport = new StdioTransport();

    await transport.connect({ command: 'node', args: [] });

    const requestPromise = transport.request('slow', undefined, 50);

    await expect(requestPromise).rejects.toThrow('timed out');
  });

  it('should reject all pending requests on process exit', async () => {
    await transport.disconnect();
    transport = new StdioTransport();

    let exitHandler: ((code: number | null) => void) | undefined;
    mockProcess.on.mockImplementation((event: string, handler: unknown) => {
      if (event === 'exit') exitHandler = handler as (code: number | null) => void;
    });
    mockProcess.stdout.on.mockImplementation(() => {});

    await transport.connect({ command: 'node', args: [] });

    const requestPromise = transport.request('tools/list');

    await vi.waitFor(() => mockProcess.stdin!.write.mock.calls.length > 0, { timeout: 1000 });
    const written = (mockProcess.stdin!.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const msg = JSON.parse(written);

    exitHandler!(1);

    await expect(requestPromise).rejects.toThrow('exited with code 1');
  });

  it('should disconnect and reject pending requests', async () => {
    await transport.disconnect();
    transport = new StdioTransport();

    mockProcess.stdout.on.mockImplementation(() => {});

    await transport.connect({ command: 'node', args: [] });

    const requestPromise = transport.request('tools/list');

    await vi.waitFor(() => mockProcess.stdin!.write.mock.calls.length > 0, { timeout: 1000 });

    await transport.disconnect();

    await expect(requestPromise).rejects.toThrow('Transport disconnected');
    expect(mockProcess.kill).toHaveBeenCalled();
  });
});
