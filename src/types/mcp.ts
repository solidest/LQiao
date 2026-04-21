/** MCP 协议类型定义 */

/** MCP 工具描述（来自 tools/list） */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** MCP 工具调用结果 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    mimeType?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

/** MCP 服务器配置 */
export interface MCPServerConfig {
  /** 启动命令（如 'npx', 'node'） */
  command: string;
  /** 启动参数 */
  args: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 传输方式 */
  transport?: 'stdio' | 'sse';
  /** SSE 连接 URL（transport 为 'sse' 时使用） */
  sseUrl?: string;
  /** 连接超时（毫秒） */
  timeout?: number;
}

/** MCP 客户端状态 */
export type MCPState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** MCP 客户端事件数据 */
export interface MCPEventData {
  state: MCPState;
  serverName?: string;
  toolsFound?: number;
  error?: string;
}
