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
    version: "0.3.0",
  });

  // ============================================
  // MCP-Level Operations
  // ============================================

  // Tool 1: List all MCPs
  server.tool(
    "list_mcps",
    "List all available MCP servers with their connection status and tool counts.",
    {},
    async () => {
      const mcps = clientManager.listMCPs();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(mcps, null, 2),
          },
        ],
      };
    }
  );

  // Tool 2: Search MCPs
  server.tool(
    "search_mcps",
    "Search for MCP servers by name.",
    {
      query: z.string().optional().describe("Keywords to search for in MCP names"),
    },
    async ({ query }) => {
      const mcps = clientManager.searchMCPs(query);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(mcps, null, 2),
          },
        ],
      };
    }
  );

  // Tool 3: Get MCP details
  server.tool(
    "get_mcp_details",
    "Get detailed information about a specific MCP including its available tools.",
    {
      mcp_name: z.string().describe("The name of the MCP to get details for"),
    },
    async ({ mcp_name }) => {
      const details = await clientManager.getMCPDetails(mcp_name);

      if (!details) {
        return {
          content: [
            {
              type: "text" as const,
              text: `MCP not found: ${mcp_name}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(details, null, 2),
          },
        ],
      };
    }
  );

  // ============================================
  // Tool-Level Operations
  // ============================================

  // Tool 4: List tools for a specific MCP
  server.tool(
    "list_tools",
    "List all tools available in a specific MCP server.",
    {
      mcp_name: z.string().describe("The MCP to list tools from"),
    },
    async ({ mcp_name }) => {
      const tools = await clientManager.listToolsForMCP(mcp_name);

      if (tools.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No tools found for MCP: ${mcp_name} (MCP may not exist or has no tools)`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              tools.map((t) => ({ name: t.name, description: t.description })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 5: Search tools across all MCPs or within a specific MCP
  server.tool(
    "search_tools",
    "Search for tools across all MCPs or within a specific MCP.",
    {
      query: z.string().optional().describe("Search query to filter tools by name or description"),
      mcp_name: z.string().optional().describe("Optional: Scope search to a specific MCP"),
    },
    async ({ query, mcp_name }) => {
      const results = await clientManager.searchTools(query, mcp_name);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              results.map((t) => ({ name: t.name, source: t.source, description: t.description })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 6: Get tool details (schema, description)
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

  // Tool 7: Execute a tool
  server.tool(
    "execute_tool",
    "Execute a tool from one of the aggregated MCPs.",
    {
      tool_name: z.string().describe("The name of the tool to execute"),
      arguments: z
        .record(z.string(), z.any())
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

  // Start the server (lazy connection - MCPs connect on demand)
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
