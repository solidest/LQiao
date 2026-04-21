import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockHttpGet = vi.fn();
const mockHttpsGet = vi.fn();
const mockHttpRequest = vi.fn();

vi.mock('node:http', () => ({
  default: {
    get: (...args: unknown[]) => mockHttpGet(...args),
    request: (...args: unknown[]) => mockHttpRequest(...args),
  },
}));

vi.mock('node:https', () => ({
  default: {
    get: (...args: unknown[]) => mockHttpsGet(...args),
    request: (...args: unknown[]) => mockHttpRequest(...args),
  },
}));

import { SSETransport } from '../../../src/mcp/transports/sse';

function makeMockReq() {
  return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
}

function makeMockRes(overrides: Partial<{ statusCode: number; onData: (handler: (chunk: Buffer) => void) => void; onEnd: () => void }> = {}) {
  const handlers: Record<string, Array<(arg: unknown) => void>> = {};
  return {
    statusCode: overrides.statusCode ?? 200,
    on: vi.fn((event: string, handler: unknown) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler as (arg: unknown) => void);

      if (event === 'data' && overrides.onData) {
        setTimeout(() => {
          const fn = handler as (chunk: Buffer) => void;
          overrides.onData!(fn);
        }, 0);
      }
      if (event === 'end' && overrides.onEnd) {
        setTimeout(() => {
          (handler as () => void)();
        }, 20);
      }
    }),
  };
}

describe('SSETransport', () => {
  let transport: SSETransport;

    beforeEach(() => {
    vi.clearAllMocks();
    mockHttpGet.mockReset();
    mockHttpRequest.mockReset();
    mockHttpsGet.mockReset();
    transport = new SSETransport({ connectTimeout: 5000 });
  });

  afterEach(async () => {
    await transport.disconnect().catch(() => {});
  });

  it('should fail on non-200 status', async () => {
    mockHttpGet.mockImplementation((url: string, opts: unknown, cb: (res: { statusCode: number }) => void) => {
      setTimeout(() => cb({ statusCode: 500 }), 0);
      return makeMockReq();
    });

    await expect(transport.connect('http://localhost:3000/events')).rejects.toThrow('HTTP 500');
  });

  it('should fail without endpoint', async () => {
    mockHttpGet.mockImplementation((url: string, opts: unknown, cb: (res: { statusCode: number }) => void) => {
      const res = makeMockRes({ onEnd: () => {} });
      setTimeout(() => cb(res), 0);
      return makeMockReq();
    });

    await expect(transport.connect('http://localhost:3000/events')).rejects.toThrow('without endpoint');
  });

  it('should connect and parse endpoint from SSE stream', async () => {
    mockHttpGet.mockImplementation((url: string, opts: unknown, cb: (res: { statusCode: number; on: ReturnType<typeof vi.fn> }) => void) => {
      const res = makeMockRes({
        onData: (handler: (chunk: Buffer) => void) => {
          handler(Buffer.from('event: endpoint\ndata: /message\n'));
        },
        onEnd: () => {},
      });
      setTimeout(() => cb(res), 0);
      return makeMockReq();
    });

    await transport.connect('http://localhost:3000/events');
    expect(transport.isConnected).toBe(true);
  });

  it('should reject pending on disconnect', async () => {
    mockHttpGet.mockImplementation((url: string, opts: unknown, cb: (res: { statusCode: number; on: ReturnType<typeof vi.fn> }) => void) => {
      const res = makeMockRes({
        onData: (handler: (chunk: Buffer) => void) => {
          handler(Buffer.from('event: endpoint\ndata: /message\n'));
        },
        onEnd: () => {},
      });
      setTimeout(() => cb(res), 0);
      return makeMockReq();
    });
    mockHttpRequest.mockImplementation((url: string, opts: unknown, cb: (res: { statusCode: number; on: ReturnType<typeof vi.fn> }) => void) => {
      // POST request - response comes via SSE, not here
      return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
    });

    await transport.connect('http://localhost:3000/events');

    const requestPromise = transport.request('tools/list');
    await transport.disconnect();
    await expect(requestPromise).rejects.toThrow('Transport disconnected');
  });

  it('should throw if not connected', async () => {
    await expect(transport.request('tools/list')).rejects.toThrow('not connected');
  });

  it('should use https for https:// URLs', async () => {
    mockHttpsGet.mockImplementation((url: string, opts: unknown, cb: (res: { statusCode: number; on: ReturnType<typeof vi.fn> }) => void) => {
      const res = makeMockRes({
        onData: (handler: (chunk: Buffer) => void) => {
          handler(Buffer.from('event: endpoint\ndata: /message\n'));
        },
        onEnd: () => {},
      });
      setTimeout(() => cb(res), 0);
      return makeMockReq();
    });

    await transport.connect('https://secure-server.example.com/events');
    expect(mockHttpsGet).toHaveBeenCalled();
    expect(mockHttpGet).not.toHaveBeenCalled();
    expect(transport.isConnected).toBe(true);
  });

  it('should send custom headers in POST requests', async () => {
    mockHttpGet.mockImplementation((url: string, opts: unknown, cb: (res: { statusCode: number; on: ReturnType<typeof vi.fn> }) => void) => {
      const res = makeMockRes({
        onData: (handler: (chunk: Buffer) => void) => {
          handler(Buffer.from('event: endpoint\ndata: /message\n'));
        },
        onEnd: () => {},
      });
      setTimeout(() => cb(res), 0);
      return makeMockReq();
    });
    mockHttpRequest.mockImplementation(() => ({ on: vi.fn(), write: vi.fn(), end: vi.fn() }));

    const authTransport = new SSETransport({
      headers: { Authorization: 'Bearer secret-token' },
    });

    await authTransport.connect('http://localhost:3000/events');

    const requestPromise = authTransport.request('tools/list');
    // Disconnect to clean up the hanging request promise (SSE stream has ended in mock)
    await authTransport.disconnect();
    await requestPromise.catch(() => {});

    expect(mockHttpRequest).toHaveBeenCalled();
    const callArgs = mockHttpRequest.mock.calls[0];
    const headers = (callArgs[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe('Bearer secret-token');
  });
});
