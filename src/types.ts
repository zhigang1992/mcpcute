export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface AggregatedTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  source: string; // Which MCP server this tool comes from
}

export interface ToolDetails {
  name: string;
  description?: string;
  inputSchema?: unknown;
  source: string;
}

export interface MCPInfo {
  name: string;
  description?: string;
}

export interface MCPDetails extends MCPInfo {
  tool_count: number;
  tools: Array<{ name: string; description?: string }>;
}
