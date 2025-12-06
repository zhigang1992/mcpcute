# mcpcute

[![npm version](https://badge.fury.io/js/mcpcute.svg)](https://www.npmjs.com/package/mcpcute)

MCP aggregator - aggregate multiple MCPs behind a single interface to reduce context pollution for AI agents.

Instead of exposing 20+ MCP tools directly to your AI agent, mcpcute provides just 3 tools:

1. **search_tools** - Search/list available tools across all aggregated MCPs (returns names only)
2. **get_tool_details** - Get detailed schema and description for a specific tool
3. **execute_tool** - Execute a tool with the given arguments

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
2. When `search_tools` is called, it lazily connects to MCP servers and caches their tool lists
3. Connections are established on-demand and reused for subsequent calls
4. Tool execution routes to the correct MCP server automatically

This reduces the initial context from potentially hundreds of tool schemas to just 3 simple tools, and startup is instant regardless of how many MCPs you configure.

## Why mcpcute?

- **Instant startup**: Lazy loading means no waiting for 20+ MCP servers to connect
- **Reduced context pollution**: Instead of loading 50+ tool schemas into your AI's context, load just 3
- **Dynamic tool discovery**: AI agents can search and discover tools as needed
- **Unified interface**: One consistent API for all your MCP tools
- **Easy configuration**: Simple JSON config to aggregate multiple MCP servers

## License

MIT
