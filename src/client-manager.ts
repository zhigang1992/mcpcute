import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPConfig, AggregatedTool, ToolDetails } from "./types.ts";

interface ConnectedClient {
  client: Client;
  transport: StdioClientTransport;
  name: string;
}

export class MCPClientManager {
  private config: MCPConfig;
  private clients: Map<string, ConnectedClient> = new Map();
  private toolsCache: Map<string, AggregatedTool> = new Map();
  private toolToServer: Map<string, string> = new Map();

  constructor(config: MCPConfig) {
    this.config = config;
  }

  async connectAll(): Promise<void> {
    const entries = Object.entries(this.config.mcpServers);

    for (const [name, serverConfig] of entries) {
      try {
        await this.connectToServer(name, serverConfig);
        console.error(`Connected to MCP server: ${name}`);
      } catch (error) {
        console.error(
          `Failed to connect to ${name}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Fetch and cache all tools
    await this.refreshToolsCache();
  }

  private async connectToServer(
    name: string,
    serverConfig: { command: string; args?: string[]; env?: Record<string, string> }
  ): Promise<void> {
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

    this.clients.set(name, { client, transport, name });
  }

  private async refreshToolsCache(): Promise<void> {
    this.toolsCache.clear();
    this.toolToServer.clear();

    for (const [serverName, { client }] of this.clients) {
      try {
        const response = await client.listTools();

        for (const tool of response.tools) {
          const aggregatedTool: AggregatedTool = {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            source: serverName,
          };

          // If there's a name collision, prefix with server name
          const existingTool = this.toolsCache.get(tool.name);
          if (existingTool) {
            // Rename existing tool
            const renamedExisting = `${existingTool.source}__${existingTool.name}`;
            this.toolsCache.delete(tool.name);
            this.toolsCache.set(renamedExisting, { ...existingTool, name: renamedExisting });
            this.toolToServer.set(renamedExisting, existingTool.source);

            // Add new tool with prefix
            const renamedNew = `${serverName}__${tool.name}`;
            this.toolsCache.set(renamedNew, { ...aggregatedTool, name: renamedNew });
            this.toolToServer.set(renamedNew, serverName);
          } else {
            this.toolsCache.set(tool.name, aggregatedTool);
            this.toolToServer.set(tool.name, serverName);
          }
        }
      } catch (error) {
        console.error(
          `Failed to list tools from ${serverName}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  async listAllTools(): Promise<AggregatedTool[]> {
    return Array.from(this.toolsCache.values());
  }

  async getToolDetails(toolName: string): Promise<ToolDetails | null> {
    const tool = this.toolsCache.get(toolName);
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
    const serverName = this.toolToServer.get(toolName);
    if (!serverName) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const connectedClient = this.clients.get(serverName);
    if (!connectedClient) {
      throw new Error(`Server not connected: ${serverName}`);
    }

    // Handle prefixed tool names - extract original name
    let originalToolName = toolName;
    if (toolName.startsWith(`${serverName}__`)) {
      originalToolName = toolName.slice(serverName.length + 2);
    }

    const result = await connectedClient.client.callTool({
      name: originalToolName,
      arguments: args,
    });

    return result;
  }

  async disconnect(): Promise<void> {
    for (const [name, { client, transport }] of this.clients) {
      try {
        await client.close();
        await transport.close();
        console.error(`Disconnected from ${name}`);
      } catch (error) {
        console.error(
          `Error disconnecting from ${name}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    this.clients.clear();
  }
}
