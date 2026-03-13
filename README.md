# MCP Memory Server

A local MCP (Model Context Protocol) memory server that enables multiple Claude Code agents to work together with persistent memory. Built with SQLite for reliable local storage.

## Features

- **Persistent Memory** - Store decisions, context, and deliverables across sessions
- **Full-Text Search** - Fast FTS5-powered keyword search
- **Checkpoints & Rollback** - Save memory snapshots and restore when needed
- **Tag-Based Organization** - Organize memories with tags
- **Production Ready** - Structured logging, validation, graceful shutdown

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Initialize the database
npm run init-db

# Start the server
npm run start
```

## Configuration

Create a `.env` file (copy from `.env.example`):

```bash
DATABASE_PATH=./data/memory.db
LOG_LEVEL=info
```

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | Path to SQLite database | `./data/memory.db` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |

## Claude Code Integration

Add to your `~/.config/claude/mcp.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/mcp-memory-server/dist/index.js"]
    }
  }
}
```

Then restart Claude Code.

## Available Tools

| Tool | Description |
|------|-------------|
| `remember` | Store a memory with tags |
| `recall` | Search memories by keyword |
| `search` | Advanced filtering with tags, date range |
| `rollback` | Restore to a previous checkpoint |
| `create_checkpoint` | Save current memory state |
| `list_checkpoints` | View available checkpoints |
| `delete_memory` | Delete a specific memory |

### remember

Store important information for later retrieval.

```json
{
  "content": "Backend architect decided to use PostgreSQL",
  "tags": ["backend-architect", "database", "architecture"],
  "metadata": { "importance": "high" }
}
```

### recall

Search for relevant memories.

```json
{
  "query": "database decisions",
  "limit": 10,
  "tags": ["backend-architect"]
}
```

### search

Find memories with advanced filtering.

```json
{
  "query": "React",
  "tags": ["frontend"],
  "sort_by": "date_desc",
  "limit": 20,
  "offset": 0
}
```

### rollback

Restore memory to a checkpoint.

```json
{
  "checkpoint_id": 1,
  "restore_description": "Restoring after failed deployment"
}
```

## Memory Integration Protocol

Add this to your agent prompts for multi-agent collaboration:

> **Memory Integration**
>
> When you start a session:
> - Recall relevant context from previous sessions using your role and the current project as search terms
> - Review any memories tagged with your agent name to pick up where you left off
>
> When you make key decisions or complete deliverables:
> - Remember the decision or deliverable with descriptive tags (your agent name, the project, the topic)
> - Include enough context that a future session — or a different agent — can understand what was done and why
>
> When handing off to another agent:
> - Remember your deliverables tagged for the receiving agent
> - Include the handoff metadata: what you completed, what's pending, and what the next agent needs to know
>
> When something fails and you need to recover:
> - Search for the last known-good state
> - Use rollback to restore to that point rather than rebuilding from scratch

## Project Structure

```
src/
├── index.ts              # Server entry point
├── config.ts             # Configuration
├── database/
│   ├── index.ts         # Database connection
│   ├── migrations.ts    # Schema setup
│   └── queries.ts       # SQL queries
├── services/            # Business logic
│   ├── memory.ts
│   ├── checkpoint.ts
│   ├── search.ts
│   └── rollback.ts
├── tools/               # MCP tool handlers
├── types/              # TypeScript types
└── utils/              # Logger, validators
```

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Initialize/recreate database
npm run init-db
```

## License

MIT
