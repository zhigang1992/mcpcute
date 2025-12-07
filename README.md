# mcpcute

[![npm version](https://badge.fury.io/js/mcpcute.svg)](https://www.npmjs.com/package/mcpcute)

MCP aggregator - aggregate multiple MCPs behind a single interface to reduce context pollution for AI agents.

Instead of exposing 20+ MCP tools directly to your AI agent, mcpcute provides a two-level hierarchy with just 7 tools:

### MCP-Level Operations
1. **list_mcps** - List all available MCP servers with their connection status
2. **search_mcps** - Search for MCP servers by name
3. **get_mcp_details** - Get detailed info about an MCP including its tools

### Tool-Level Operations
4. **list_tools** - List all tools for a specific MCP
5. **search_tools** - Search for tools (optionally scoped to a specific MCP)
6. **get_tool_details** - Get detailed schema and description for a tool
7. **execute_tool** - Execute a tool with the given arguments

## Installation

```bash
npm install -g mcpcute
# or
bun add -g mcpcute
# or
npx mcpcute
```

## Configuration

Create a `mcpcute.config.json` file in your working directory (or set `MCPCUTE_CONFIG` env var to point to your config file):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpcute": {
      "command": "npx",
      "args": ["-y", "mcpcute"],
      "env": {
        "MCPCUTE_CONFIG": "/path/to/your/mcpcute.config.json"
      }
    }
  }
}
```

### With Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "mcpcute": {
      "command": "npx",
      "args": ["-y", "mcpcute"],
      "env": {
        "MCPCUTE_CONFIG": "/path/to/your/mcpcute.config.json"
      }
    }
  }
}
```

### Standalone

```bash
# With global install
mcpcute

# Or with npx
npx mcpcute

# With custom config path
MCPCUTE_CONFIG=/path/to/config.json npx mcpcute
```

## How it works

1. mcpcute starts instantly - no upfront connections to any MCP servers
2. Use `list_mcps` or `search_mcps` to discover available MCPs (no connections needed)
3. Use `get_mcp_details` or `list_tools` to explore an MCP's capabilities (connects on-demand)
4. Use `search_tools` to find tools across all MCPs or scoped to one
5. Use `get_tool_details` to get the full schema for a tool
6. Use `execute_tool` to run the tool

This reduces the initial context from potentially hundreds of tool schemas to just 7 simple tools, and startup is instant regardless of how many MCPs you configure.

## Workflow Examples

### Discovering filesystem tools
```
1. search_mcps("file") → finds "filesystem" MCP
2. list_tools("filesystem") → shows all filesystem tools
3. get_tool_details("read_file") → see how to use it
4. execute_tool("read_file", { path: "/tmp/example.txt" }) → run it
```

### Exploring all available MCPs
```
1. list_mcps() → see all configured MCPs
2. get_mcp_details("fetch") → learn about this MCP
3. list_tools("fetch") → see what it can do
```

## Why mcpcute?

- **Instant startup**: Lazy loading means no waiting for 20+ MCP servers to connect
- **Two-level hierarchy**: Clear separation between MCP discovery and tool discovery
- **Reduced context pollution**: Instead of loading 50+ tool schemas into your AI's context, load just 7
- **Dynamic tool discovery**: AI agents can search and discover tools as needed
- **Scoped exploration**: Explore one MCP at a time instead of being overwhelmed
- **Unified interface**: One consistent API for all your MCP tools
- **Easy configuration**: Simple JSON config to aggregate multiple MCP servers

## License

MIT
