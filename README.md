# mcpcute

[![npm version](https://badge.fury.io/js/mcpcute.svg)](https://www.npmjs.com/package/mcpcute)

MCP aggregator. Puts multiple MCP servers behind one interface so an agent does not load every nested tool schema at once.

mcpcute exposes 8 tools:

### MCP-level operations
1. **list_mcps** - List configured MCP servers (name and description)
2. **search_mcps** - Search MCP servers by name
3. **get_mcp_details** - Details for one MCP, including its tools

### Configuration
4. **reload_config** - Re-read `mcpcute.config.json` from disk without restarting

### Tool-level operations
5. **list_tools** - List tools on one MCP
6. **search_tools** - Search tools, optionally scoped to one MCP
7. **get_tool_details** - Schema and description for a tool, looked up by `tool_name`
8. **execute_tool** - Run a tool. Requires `mcp_name` and `tool_name`. Tool input goes in `arguments`.

`arguments` on `execute_tool` is the JSON object forwarded to the underlying MCP `tools/call`. Config `args` is the argv used to spawn a server. They are not the same field.

Each tool description starts with `[EXPLICIT ONLY ...]`. Agents are told not to call these unless the user mentions mcpcute or asks to manage MCP servers.

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

`args` here is spawn argv, the same field Claude Desktop uses. Optional `env` and `description` are also supported.

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

1. mcpcute starts without connecting to any MCP server
2. `list_mcps` or `search_mcps` read the config only
3. `get_mcp_details` or `list_tools` connect on demand
4. `search_tools` finds tools across all MCPs or one of them
5. `get_tool_details` returns the input schema for a tool name
6. `execute_tool` runs it with `mcp_name`, `tool_name`, and `arguments`
7. `reload_config` picks up new or changed servers in the config file

The agent sees these 8 schemas at startup, not every tool on every configured server.

## Cache

mcpcute writes the discovered tool list for each MCP to disk so later runs can answer discovery without reconnecting. The cache lives in:

- macOS/Linux: `${XDG_CACHE_HOME:-~/.cache}/mcpcute`
- Windows: `%LOCALAPPDATA%/mcpcute/cache`

Override the location with `MCPCUTE_CACHE_DIR`. A cache entry is dropped when that server's `command`, `args`, or `env` change in `mcpcute.config.json`.

## Workflow examples

### Discovering filesystem tools
```
1. search_mcps("file") → finds "filesystem" MCP
2. list_tools("filesystem") → shows all filesystem tools
3. get_tool_details("read_file") → schema for that tool name
4. execute_tool({ mcp_name: "filesystem", tool_name: "read_file", arguments: { path: "/tmp/example.txt" } }) → run it
```

`get_tool_details` takes only `tool_name`. `execute_tool` always needs `mcp_name` as well. If two servers expose the same tool name, mcpcute prefixes it (`server__tool`). Pass that prefixed name to `get_tool_details`. `execute_tool` still needs `mcp_name` plus the original or prefixed `tool_name`.

### Exploring all available MCPs
```
1. list_mcps() → configured MCPs
2. get_mcp_details("fetch") → tools on that MCP
3. list_tools("fetch") → same list, tools only
```

### After editing the config
```
1. reload_config() → re-read mcpcute.config.json
2. list_mcps() → confirm the new server is there
```

## Why mcpcute?

- **Instant startup.** Lazy loading, no wait for every server to connect
- **Two-level hierarchy.** Discover MCPs first, then tools
- **Reduced context pollution.** 8 tool schemas instead of every nested tool
- **Dynamic tool discovery.** Search when needed
- **Scoped exploration.** One MCP at a time
- **Unified interface.** One API for all aggregated tools
- **Easy configuration.** JSON config of MCP servers

## License

MIT
