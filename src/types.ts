export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
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
  tool_count: number;
}

export interface MCPDetails extends MCPInfo {
  tools: Array<{ name: string; description?: string }>;
}
