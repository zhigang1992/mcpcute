import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MCPClientManager } from "./client-manager.ts";
import type { MCPConfig } from "./types.ts";

const CONFIG_PATH = process.env.MCPCUTE_CONFIG || "./mcpcute.config.json";

async function loadConfig(): Promise<MCPConfig> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) {
    console.error(`Config file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }
  return await file.json();
}

async function main() {
  const config = await loadConfig();
  const clientManager = new MCPClientManager(config);

  const server = new McpServer({
    name: "mcpcute",
    version: "0.1.0",
  });

  // Tool 1: Search/list available tools across all MCPs
  server.tool(
    "search_tools",
    "Search for available tools across all aggregated MCPs. Returns tool names only.",
    {
      query: z.string().optional().describe("Optional search query to filter tools by name"),
    },
    async ({ query }) => {
      const tools = await clientManager.listAllTools();

      let results = tools;
      if (query) {
        const lowerQuery = query.toLowerCase();
        results = tools.filter((t) => t.name.toLowerCase().includes(lowerQuery));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              results.map((t) => ({ name: t.name, source: t.source })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 2: Get tool details (schema, description)
  server.tool(
    "get_tool_details",
    "Get detailed information about a specific tool including its input schema and description.",
    {
      tool_name: z.string().describe("The name of the tool to get details for"),
    },
    async ({ tool_name }) => {
      const tool = await clientManager.getToolDetails(tool_name);

      if (!tool) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Tool not found: ${tool_name}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(tool, null, 2),
          },
        ],
      };
    }
  );

  // Tool 3: Execute a tool
  server.tool(
    "execute_tool",
    "Execute a tool from one of the aggregated MCPs.",
    {
      tool_name: z.string().describe("The name of the tool to execute"),
      arguments: z
        .record(z.unknown())
        .optional()
        .describe("Arguments to pass to the tool"),
    },
    async ({ tool_name, arguments: args }) => {
      try {
        const result = await clientManager.executeTool(tool_name, args || {});
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Connect to all configured MCPs
  await clientManager.connectAll();

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
