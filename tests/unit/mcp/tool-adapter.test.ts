import { describe, it, expect, vi } from 'vitest';
import { MCPToolAdapter, wrapMCPTools } from '../../../src/tools/mcp-tool';
import type { MCPClient } from '../../../src/mcp/client';

function createMockClient(): MCPClient {
  return {
    callTool: vi.fn(),
    getTools: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
    state: 'connected',
    serverConfig: { command: 'test', args: [] },
    on: vi.fn(),
  } as unknown as MCPClient;
}

describe('MCPToolAdapter', () => {
  it('should wrap MCP tool as local Tool', () => {
    const client = createMockClient();
    const mcpTool = {
      name: 'read_file',
      description: 'Read a file from disk',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
    };

    const adapter = new MCPToolAdapter(client, mcpTool);

    expect(adapter.name).toBe('read_file');
    expect(adapter.description).toBe('Read a file from disk');
    expect(adapter.parameters).toEqual(mcpTool.inputSchema);
  });

  it('should call MCP tool with object args', async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'hello world' }],
    });
    const client = { ...createMockClient(), callTool } as unknown as MCPClient;

    const adapter = new MCPToolAdapter(client, {
      name: 'greet',
      description: 'Greet someone',
      inputSchema: {},
    });

    const result = await adapter.execute({ name: 'Alice' });

    expect(result.success).toBe(true);
    expect(result.data).toBe('hello world');
    expect(callTool).toHaveBeenCalledWith('greet', { name: 'Alice' });
  });

  it('should handle error tool result', async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'permission denied' }],
      isError: true,
    });
    const client = { ...createMockClient(), callTool } as unknown as MCPClient;

    const adapter = new MCPToolAdapter(client, {
      name: 'delete',
      description: 'Delete a file',
      inputSchema: {},
    });

    const result = await adapter.execute({ path: '/important.txt' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('permission denied');
  });

  it('should handle MCP call failure', async () => {
    const callTool = vi.fn().mockRejectedValue(new Error('timeout'));
    const client = { ...createMockClient(), callTool } as unknown as MCPClient;

    const adapter = new MCPToolAdapter(client, {
      name: 'slow',
      description: 'Slow operation',
      inputSchema: {},
    });

    const result = await adapter.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('should extract text from multi-content result', async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'line 1' },
        { type: 'text', text: 'line 2' },
        { type: 'image', mimeType: 'image/png' },
      ],
    });
    const client = { ...createMockClient(), callTool } as unknown as MCPClient;

    const adapter = new MCPToolAdapter(client, { name: 'multi', description: '', inputSchema: {} });

    const result = await adapter.execute({});

    expect(result.data).toBe('line 1\nline 2');
  });

  it('should handle positional args', async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    const client = { ...createMockClient(), callTool } as unknown as MCPClient;

    const adapter = new MCPToolAdapter(client, { name: 'echo', description: '', inputSchema: {} });

    const result = await adapter.execute('hello');

    expect(result.success).toBe(true);
    expect(callTool).toHaveBeenCalledWith('echo', { value: 'hello' });
  });

  it('should handle no args', async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'empty' }] });
    const client = { ...createMockClient(), callTool } as unknown as MCPClient;

    const adapter = new MCPToolAdapter(client, { name: 'status', description: '', inputSchema: {} });

    const result = await adapter.execute();

    expect(result.success).toBe(true);
    expect(callTool).toHaveBeenCalledWith('status', {});
  });
});

describe('wrapMCPTools', () => {
  it('should wrap all discovered tools', () => {
    const callTool = vi.fn();
    const client = {
      callTool,
      getTools: vi.fn().mockReturnValue([
        { name: 'tool_a', description: 'A', inputSchema: {} },
        { name: 'tool_b', description: 'B', inputSchema: {} },
      ]),
    } as unknown as MCPClient;

    const adapters = wrapMCPTools(client);

    expect(adapters).toHaveLength(2);
    expect(adapters[0].name).toBe('tool_a');
    expect(adapters[1].name).toBe('tool_b');
  });
});
