/** Result returned by tool execution */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/** Tool parameter schema (JSON Schema compatible) */
export type ToolParameters = Record<string, unknown>;

/** Tool interface — all tools must implement this */
export interface Tool {
  /** Unique tool name */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for tool parameters */
  parameters?: ToolParameters;
  /** Execute the tool with given arguments */
  execute(...args: unknown[]): Promise<ToolResult>;
}
