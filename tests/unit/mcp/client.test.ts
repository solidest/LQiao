import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClient } from '../../../src/mcp/client';

// Mock StdioTransport
const mockStdioRequest = vi.fn();
const mockStdioConnect = vi.fn().mockResolvedValue(undefined);
const mockStdioDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../src/mcp/transports/stdio', () => ({
  StdioTransport: vi.fn().mockImplementation(() => ({
    connect: mockStdioConnect,
    disconnect: mockStdioDisconnect,
    request: mockStdioRequest,
  })),
}));

// Mock SSETransport
const mockSSEConnect = vi.fn().mockResolvedValue(undefined);
const mockSSEDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSSERequest = vi.fn();

vi.mock('../../../src/mcp/transports/sse', () => ({
  SSETransport: vi.fn().mockImplementation(() => ({
    connect: mockSSEConnect,
    disconnect: mockSSEDisconnect,
    request: mockSSERequest,
    isConnected: true,
  })),
}));

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStdioConnect.mockResolvedValue(undefined);
    mockStdioDisconnect.mockResolvedValue(undefined);
    mockStdioRequest.mockResolvedValue({ tools: [] });
    mockSSEConnect.mockResolvedValue(undefined);
    mockSSEDisconnect.mockResolvedValue(undefined);
    mockSSERequest.mockResolvedValue({ tools: [] });

    client = new MCPClient({
      command: 'node',
      args: ['mcp-server.js'],
    });
  });

  it('should start in disconnected state', () => {
    expect(client.state).toBe('disconnected');
    expect(client.isConnected).toBe(false);
  });

  it('should connect and discover tools', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'tools/list') {
        return Promise.resolve({
          tools: [
            { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
          ],
        });
      }
      return Promise.resolve({});
    });

    await client.connect();

    expect(client.isConnected).toBe(true);
    expect(client.state).toBe('connected');
    expect(client.getTools()).toHaveLength(1);
    expect(client.getTools()[0].name).toBe('read_file');
  });

  it('should call a tool', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'tools/list') return Promise.resolve({ tools: [] });
      if (method === 'tools/call') {
        return Promise.resolve({
          content: [{ type: 'text', text: 'file content' }],
        });
      }
      return Promise.resolve({});
    });

    await client.connect();

    const result = await client.callTool('read_file', { path: '/test.txt' });
    expect(result.content).toHaveLength(1);
    expect(result.content![0].text).toBe('file content');
  });

  it('should return error tool result when tool fails', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'tools/list') return Promise.resolve({ tools: [] });
      if (method === 'tools/call') {
        return Promise.resolve({ content: [{ type: 'text', text: 'error!' }], isError: true });
      }
      return Promise.resolve({});
    });

    await client.connect();

    const result = await client.callTool('broken_tool', {});
    expect(result.isError).toBe(true);
  });

  it('should disconnect and clear state', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'tools/list') return Promise.resolve({ tools: [] });
      return Promise.resolve({});
    });

    await client.connect();
    expect(client.getTools()).toHaveLength(0);

    await client.disconnect();

    expect(client.isConnected).toBe(false);
    expect(client.state).toBe('disconnected');
    expect(client.getTools()).toHaveLength(0);
    expect(mockStdioDisconnect).toHaveBeenCalled();
  });

  it('should fail if initialize throws', async () => {
    mockStdioRequest.mockRejectedValue(new Error('Connection refused'));

    await expect(client.connect()).rejects.toThrow('Connection refused');
    expect(client.state).toBe('error');
  });

  it('should fail if tools/list throws', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'initialize') return Promise.resolve({});
      if (method === 'tools/list') return Promise.reject(new Error('Discovery failed'));
      return Promise.resolve({});
    });

    await expect(client.connect()).rejects.toThrow('Discovery failed');
  });

  it('should reject tool calls when not connected', async () => {
    await expect(client.callTool('x', {})).rejects.toThrow('No transport available');
  });

  it('should expose server config', () => {
    expect(client.serverConfig.command).toBe('node');
    expect(client.serverConfig.args).toEqual(['mcp-server.js']);
  });

  it('should emit stateChange event', async () => {
    const states: string[] = [];
    client.on('stateChange', (data: { state: string }) => states.push(data.state));

    mockStdioRequest.mockResolvedValue({ tools: [] });
    await client.connect();

    expect(states).toContain('connecting');
    expect(states).toContain('connected');
  });

  it('should emit toolsDiscovered event', async () => {
    let toolsCount = -1;
    client.on('toolsDiscovered', (data: { tools: number }) => { toolsCount = data.tools; });

    mockStdioRequest.mockResolvedValue({
      tools: [
        { name: 'a', description: 'A', inputSchema: {} },
        { name: 'b', description: 'B', inputSchema: {} },
      ],
    });

    await client.connect();
    expect(toolsCount).toBe(2);
  });

  it('should support SSE transport config', async () => {
    mockSSERequest.mockImplementation((method: string) => {
      if (method === 'tools/list') return Promise.resolve({ tools: [] });
      return Promise.resolve({});
    });

    const sseClient = new MCPClient({
      command: 'remote-server',
      args: [],
      transport: 'sse',
      sseUrl: 'http://localhost:3000/events',
    });

    await sseClient.connect();
    expect(sseClient.isConnected).toBe(true);

    await sseClient.disconnect();
    expect(mockSSEDisconnect).toHaveBeenCalled();
  });

  it('should fail SSE without sseUrl', async () => {
    const sseClient = new MCPClient({
      command: 'remote-server',
      args: [],
      transport: 'sse',
    });

    await expect(sseClient.connect()).rejects.toThrow('requires sseUrl');
  });
});
