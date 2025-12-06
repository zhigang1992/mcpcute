import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPConfig, MCPServerConfig, AggregatedTool, ToolDetails, MCPInfo, MCPDetails } from "./types.ts";

interface ConnectedClient {
  client: Client;
  transport: StdioClientTransport;
  name: string;
}

interface ServerToolsCache {
  tools: AggregatedTool[];
  fetched: boolean;
}

export class MCPClientManager {
  private config: MCPConfig;
  private clients: Map<string, ConnectedClient> = new Map();
  private serverToolsCache: Map<string, ServerToolsCache> = new Map();
  private toolToServer: Map<string, string> = new Map();
  private toolsAggregated: boolean = false;

  constructor(config: MCPConfig) {
    this.config = config;
    // Initialize cache entries for all servers (not connected yet)
    for (const serverName of Object.keys(config.mcpServers)) {
      this.serverToolsCache.set(serverName, { tools: [], fetched: false });
    }
  }

  private async connectToServer(
    name: string,
    serverConfig: MCPServerConfig
  ): Promise<ConnectedClient> {
    // Return existing connection if available
    const existing = this.clients.get(name);
    if (existing) {
      return existing;
    }

    console.error(`[mcpcute] Connecting to MCP server: ${name}...`);

    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env: { ...process.env, ...serverConfig.env } as Record<string, string>,
    });

    const client = new Client({
      name: `mcpcute-client-${name}`,
      version: "0.1.0",
    });

    await client.connect(transport);

    const connectedClient = { client, transport, name };
    this.clients.set(name, connectedClient);

    console.error(`[mcpcute] Connected to MCP server: ${name}`);

    return connectedClient;
  }

  private async fetchToolsFromServer(serverName: string): Promise<AggregatedTool[]> {
    const cache = this.serverToolsCache.get(serverName);
    if (cache?.fetched) {
      return cache.tools;
    }

    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig) {
      return [];
    }

    try {
      const { client } = await this.connectToServer(serverName, serverConfig);
      const response = await client.listTools();

      const tools: AggregatedTool[] = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        source: serverName,
      }));

      this.serverToolsCache.set(serverName, { tools, fetched: true });

      return tools;
    } catch (error) {
      console.error(
        `[mcpcute] Failed to fetch tools from ${serverName}:`,
        error instanceof Error ? error.message : String(error)
      );
      this.serverToolsCache.set(serverName, { tools: [], fetched: true });
      return [];
    }
  }

  private aggregateTools(allTools: AggregatedTool[]): void {
    this.toolToServer.clear();

    // Group tools by name to detect collisions
    const toolsByName = new Map<string, AggregatedTool[]>();
    for (const tool of allTools) {
      const existing = toolsByName.get(tool.name) || [];
      existing.push(tool);
      toolsByName.set(tool.name, existing);
    }

    // Handle collisions by prefixing with server name
    for (const [name, tools] of toolsByName) {
      if (tools.length === 1) {
        this.toolToServer.set(name, tools[0].source);
      } else {
        // Collision - prefix all with server name
        for (const tool of tools) {
          const prefixedName = `${tool.source}__${tool.name}`;
          tool.name = prefixedName;
          this.toolToServer.set(prefixedName, tool.source);
        }
      }
    }

    this.toolsAggregated = true;
  }

  async listAllTools(): Promise<AggregatedTool[]> {
    const serverNames = Object.keys(this.config.mcpServers);

    // Fetch tools from all servers in parallel
    const toolsArrays = await Promise.all(
      serverNames.map((name) => this.fetchToolsFromServer(name))
    );

    const allTools = toolsArrays.flat();

    if (!this.toolsAggregated) {
      this.aggregateTools(allTools);
    }

    return allTools;
  }

  async searchTools(query?: string, mcpName?: string): Promise<AggregatedTool[]> {
    // If scoped to a specific MCP
    if (mcpName) {
      const tools = await this.listToolsForMCP(mcpName);
      if (!query) {
        return tools;
      }
      const lowerQuery = query.toLowerCase();
      return tools.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.description?.toLowerCase().includes(lowerQuery)
      );
    }

    // If no query, we need all tools
    if (!query) {
      return this.listAllTools();
    }

    const lowerQuery = query.toLowerCase();
    const serverNames = Object.keys(this.config.mcpServers);
    const matchingTools: AggregatedTool[] = [];

    // Check each server - but we can be smarter here
    // If a server name matches the query, prioritize connecting to it
    const matchingServers = serverNames.filter((name) =>
      name.toLowerCase().includes(lowerQuery)
    );
    const otherServers = serverNames.filter(
      (name) => !name.toLowerCase().includes(lowerQuery)
    );

    // Fetch from matching servers first (more likely to have relevant tools)
    for (const serverName of [...matchingServers, ...otherServers]) {
      const tools = await this.fetchToolsFromServer(serverName);
      const matches = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.description?.toLowerCase().includes(lowerQuery)
      );
      matchingTools.push(...matches);
    }

    if (!this.toolsAggregated) {
      // Get all tools to properly aggregate names
      await this.listAllTools();
    }

    return matchingTools;
  }

  async getToolDetails(toolName: string): Promise<ToolDetails | null> {
    // First check if we already know which server has this tool
    let serverName = this.toolToServer.get(toolName);

    // Check if it's a prefixed name
    if (!serverName) {
      const parts = toolName.split("__");
      if (parts.length >= 2) {
        serverName = parts[0];
      }
    }

    // If we know the server, just fetch from that one
    if (serverName && this.config.mcpServers[serverName]) {
      const tools = await this.fetchToolsFromServer(serverName);
      const tool = tools.find((t) => t.name === toolName);
      if (tool) {
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          source: tool.source,
        };
      }
    }

    // Otherwise, we need to search all servers
    const allTools = await this.listAllTools();
    const tool = allTools.find((t) => t.name === toolName);

    if (!tool) {
      return null;
    }

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      source: tool.source,
    };
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // Find which server has this tool
    let serverName = this.toolToServer.get(toolName);

    // Check if it's a prefixed name
    let originalToolName = toolName;
    if (!serverName) {
      const parts = toolName.split("__");
      if (parts.length >= 2) {
        serverName = parts[0];
        originalToolName = parts.slice(1).join("__");
      }
    }

    // If still not found, try to list all tools first
    if (!serverName) {
      await this.listAllTools();
      serverName = this.toolToServer.get(toolName);
    }

    if (!serverName) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig) {
      throw new Error(`Server not found: ${serverName}`);
    }

    // Connect to the server if not already connected
    const { client } = await this.connectToServer(serverName, serverConfig);

    // Handle prefixed tool names - extract original name
    if (toolName.startsWith(`${serverName}__`)) {
      originalToolName = toolName.slice(serverName.length + 2);
    }

    const result = await client.callTool({
      name: originalToolName,
      arguments: args,
    });

    return result;
  }

  // MCP-level operations

  listMCPs(): MCPInfo[] {
    const mcpNames = Object.keys(this.config.mcpServers);
    return mcpNames.map((name) => {
      const cache = this.serverToolsCache.get(name);
      const isConnected = this.clients.has(name);
      return {
        name,
        status: isConnected ? "connected" : "disconnected",
        tool_count: cache?.fetched ? cache.tools.length : 0,
      };
    });
  }

  searchMCPs(query?: string): MCPInfo[] {
    const allMCPs = this.listMCPs();
    if (!query) {
      return allMCPs;
    }
    const lowerQuery = query.toLowerCase();
    return allMCPs.filter((mcp) => mcp.name.toLowerCase().includes(lowerQuery));
  }

  async getMCPDetails(mcpName: string): Promise<MCPDetails | null> {
    if (!this.config.mcpServers[mcpName]) {
      return null;
    }

    const tools = await this.fetchToolsFromServer(mcpName);
    const isConnected = this.clients.has(mcpName);

    return {
      name: mcpName,
      status: isConnected ? "connected" : "disconnected",
      tool_count: tools.length,
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    };
  }

  async listToolsForMCP(mcpName: string): Promise<AggregatedTool[]> {
    if (!this.config.mcpServers[mcpName]) {
      return [];
    }
    return this.fetchToolsFromServer(mcpName);
  }

  async disconnect(): Promise<void> {
    for (const [name, { client, transport }] of this.clients) {
      try {
        await client.close();
        await transport.close();
        console.error(`[mcpcute] Disconnected from ${name}`);
      } catch (error) {
        console.error(
          `[mcpcute] Error disconnecting from ${name}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    this.clients.clear();
  }
}
