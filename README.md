# mcpcute

MCP aggregator - aggregate multiple MCPs behind a single interface to reduce context pollution for AI agents.

Instead of exposing 20+ MCP tools directly to your AI agent, mcpcute provides just 3 tools:

1. **search_tools** - Search/list available tools across all aggregated MCPs (returns names only)
2. **get_tool_details** - Get detailed schema and description for a specific tool
3. **execute_tool** - Execute a tool with the given arguments

## Installation

```bash
bun install
```

## Configuration

Create a `mcpcute.config.json` file (or set `MCPCUTE_CONFIG` env var):

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

See `mcpcute.config.example.json` for a full example.

## Usage

### As an MCP server

```bash
bun run start
```

### In Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpcute": {
      "command": "bun",
      "args": ["run", "/path/to/mcpcute/src/index.ts"],
      "env": {
        "MCPCUTE_CONFIG": "/path/to/mcpcute.config.json"
      }
    }
  }
}
```

## How it works

1. mcpcute connects to all configured MCP servers on startup
2. It caches the list of available tools from each server
3. When an AI agent needs a tool, it first searches with `search_tools`
4. Then it gets the schema with `get_tool_details`
5. Finally, it executes with `execute_tool`

This reduces the initial context from potentially hundreds of tool schemas to just 3 simple tools.

## License

MIT
