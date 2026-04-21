import { ToolBase } from '../tools/base';
import type { ToolResult } from '../types/tool';
import type { MCPClient } from '../mcp/client';
import type { MCPTool } from '../types/mcp';

/**
 * Wraps a remote MCP tool as a local ToolBase, making it usable by Agent.
 * Each instance proxies to a single MCP tool via the connected MCPClient.
 */
export class MCPToolAdapter extends ToolBase {
  name: string;
  description: string;

  #client: MCPClient;
  #mcpTool: MCPTool;

  constructor(client: MCPClient, mcpTool: MCPTool) {
    super();
    this.#client = client;
    this.#mcpTool = mcpTool;
    this.name = mcpTool.name;
    this.description = mcpTool.description;
    this.parameters = validateInputSchema(mcpTool.inputSchema);
  }

  protected async doExecute(...args: unknown[]): Promise<ToolResult> {
    const inputArgs = extractArgs(args);
    try {
      const result = await this.#client.callTool(this.#mcpTool.name, inputArgs);

      if (result.isError) {
        const text = extractTextContent(result);
        return { success: false, error: text ?? 'MCP tool returned an error', data: result };
      }

      const text = extractTextContent(result);
      return { success: true, data: text ?? result, metadata: { source: 'mcp', tool: this.#mcpTool.name } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}

/**
 * Helper: convert an MCPClient's discovered tools into an array of MCPToolAdapter instances.
 */
export function wrapMCPTools(client: MCPClient): MCPToolAdapter[] {
  return client.getTools().map((tool) => new MCPToolAdapter(client, tool));
}

function extractArgs(args: unknown[]): Record<string, unknown> {
  if (args.length === 0) return {};
  const first = args[0];
  if (typeof first === 'object' && first !== null) {
    return first as Record<string, unknown>;
  }
  return { value: first };
}

function extractTextContent(result: { content?: Array<{ type: string; text?: string }> }): string | undefined {
  if (!result.content) return undefined;
  const texts = result.content.filter((c) => c.type === 'text' && c.text).map((c) => c.text!);
  return texts.join('\n');
}

/** Validate that inputSchema is a well-formed object, return {} if malformed */
function validateInputSchema(schema: unknown): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return {};
  }
  const obj = schema as Record<string, unknown>;
  if (typeof obj.type === 'string' || typeof obj.properties === 'object' && obj.properties !== null) {
    return obj;
  }
  return {};
}
