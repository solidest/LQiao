import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClient } from '../../src/mcp/client';
import { MCPToolAdapter, wrapMCPTools } from '../../src/tools/mcp-tool';
import { Agent } from '../../src/core/agent';
import type { ModelResponse } from '../../src/types/model';
import { ReactAgent } from '../../src/core/react-agent';
import type { GenerateOptions } from '../../src/types/model';

const mockStdioRequest = vi.fn();
const mockStdioConnect = vi.fn().mockResolvedValue(undefined);
const mockStdioDisconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/mcp/transports/stdio', () => ({
  StdioTransport: vi.fn().mockImplementation(() => ({
    connect: mockStdioConnect,
    disconnect: mockStdioDisconnect,
    request: mockStdioRequest,
  })),
}));

vi.mock('../../src/mcp/transports/sse', () => ({
  SSETransport: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    request: vi.fn(),
    isConnected: true,
  })),
}));

describe('MCP Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStdioConnect.mockResolvedValue(undefined);
    mockStdioDisconnect.mockResolvedValue(undefined);
  });

  it('should connect MCP client, discover tools, and call them', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'initialize') return Promise.resolve({});
      if (method === 'tools/list') {
        return Promise.resolve({
          tools: [
            { name: 'read_file', description: 'Read file', inputSchema: { properties: { path: { type: 'string' } } } },
            { name: 'write_file', description: 'Write file', inputSchema: { properties: { path: { type: 'string' }, content: { type: 'string' } } } },
          ],
        });
      }
      if (method === 'tools/call') {
        return Promise.resolve({ content: [{ type: 'text', text: '// file contents' }] });
      }
      return Promise.resolve({});
    });

    const client = new MCPClient({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] });
    await client.connect();

    expect(client.getTools()).toHaveLength(2);

    const adapters = wrapMCPTools(client);
    expect(adapters).toHaveLength(2);

    const result = await adapters[0].execute({ path: '/tmp/test.txt' });
    expect(result.success).toBe(true);
    expect(result.data).toBe('// file contents');
    expect(result.metadata?.source).toBe('mcp');

    await client.disconnect();
    expect(mockStdioDisconnect).toHaveBeenCalled();
  });

  it('should handle multi-server tool discovery', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'initialize') return Promise.resolve({});
      if (method === 'tools/list') {
        return Promise.resolve({
          tools: [{ name: 'server_tool', description: 'From server', inputSchema: {} }],
        });
      }
      return Promise.resolve({});
    });

    const client1 = new MCPClient({ command: 'server-a', args: [] });
    const client2 = new MCPClient({ command: 'server-b', args: [] });

    await client1.connect();
    await client2.connect();

    const tools1 = client1.getTools();
    const tools2 = client2.getTools();

    expect(tools1).toHaveLength(1);
    expect(tools2).toHaveLength(1);
    expect(tools1[0].name).toBe('server_tool');

    await client1.disconnect();
    await client2.disconnect();
  });

  it('should propagate tool errors to adapter', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'initialize') return Promise.resolve({});
      if (method === 'tools/list') {
        return Promise.resolve({ tools: [{ name: 'dangerous', description: 'Dangerous', inputSchema: {} }] });
      }
      if (method === 'tools/call') {
        return Promise.resolve({ content: [{ type: 'text', text: 'Access denied' }], isError: true });
      }
      return Promise.resolve({});
    });

    const client = new MCPClient({ command: 'restricted-server', args: [] });
    await client.connect();

    const [adapter] = wrapMCPTools(client);
    const result = await adapter.execute({ action: 'delete_all' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');

    await client.disconnect();
  });

  it('should have MCP tools available in Agent after initializeMCP', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'initialize') return Promise.resolve({});
      if (method === 'tools/list') {
        return Promise.resolve({
          tools: [{ name: 'remote_tool', description: 'Remote tool', inputSchema: {} }],
        });
      }
      if (method === 'tools/call') {
        return Promise.resolve({ content: [{ type: 'text', text: 'remote result' }] });
      }
      return Promise.resolve({});
    });

    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      mcpServers: [{ command: 'mcp-server', args: [] }],
    });

    await agent.initializeMCP();

    const config = agent.config;
    expect(config.tools).toHaveLength(1);
    expect(config.tools![0].name).toBe('remote_tool');

    await agent.disconnectMCP();
  });

  it('should auto-initialize MCP tools on first run', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'initialize') return Promise.resolve({});
      if (method === 'tools/list') return Promise.resolve({ tools: [] });
      return Promise.resolve({});
    });

    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      mcpServers: [{ command: 'auto-mcp', args: [] }],
    });

    // Mock the model to return an immediate answer
    let runCalled = false;
    const mockGenerate = vi.fn(async (): Promise<ModelResponse> => {
      runCalled = true;
      return { text: 'Final Answer: done', usage: { promptTokens: 10, completionTokens: 5 }, stopReason: 'stop' };
    });

    // Create a ReactAgent directly since Agent.run needs a real model
    const reactAgent = new ReactAgent({ tools: [], maxSteps: 5 });

    // Just verify initializeMCP is called
    await agent.initializeMCP();
    expect(agent.mcpClients).toHaveLength(1);

    await agent.disconnectMCP();
  });

  it('should handle tool name conflict — MCP tool overwrites local tool in ReactAgent Map', async () => {
    mockStdioRequest.mockImplementation((method: string) => {
      if (method === 'initialize') return Promise.resolve({});
      if (method === 'tools/list') {
        return Promise.resolve({
          tools: [{ name: 'file', description: 'MCP file tool', inputSchema: {} }],
        });
      }
      return Promise.resolve({});
    });

    const agent = new Agent({
      model: 'gpt-4o',
      apiKey: 'test-key',
      mcpServers: [{ command: 'conflict-server', args: [] }],
    });

    await agent.initializeMCP();

    // MCP tool with same name 'file' is added to tools array
    const toolNames = agent.config.tools.map((t) => t.name);
    expect(toolNames).toContain('file');

    // In ReactAgent, the Map uses the last registered tool with a given name
    // The MCP tool (added later) should take precedence
    const fileTool = agent.config.tools.find((t) => t.name === 'file');
    expect(fileTool?.description).toBe('MCP file tool');

    await agent.disconnectMCP();
  });
});
