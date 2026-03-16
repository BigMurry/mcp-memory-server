# MCP Memory Server - Architecture Specification

## Overview

A local MCP memory server that enables multiple Claude Code agents to work together with persistent memory. This server provides the memory capabilities required by the [agency-agents](https://github.com/msitarzewski/agency-agents) standard.

## Domain Model & Database Schema

The core domain has three entities: **Memory** (the primary aggregate), **Tag** (categorization), and **Checkpoint** (state snapshots).

```
┌─────────────────────────────────────────────────────────────────┐
│                      MEMORY SERVER ARCHITECTURE                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   MEMORY     │     │     TAG      │     │  CHECKPOINT  │   │
│  ├──────────────┤     ├──────────────┤     ├──────────────┤   │
│  │ id (PK)      │────<│ memory_id (FK)     │ id (PK)      │   │
│  │ content      │     │ tag_id (FK)  │     │ snapshot     │   │
│  │ created_at   │     │ name         │     │ created_at   │   │
│  │ updated_at   │     │ id (PK)      │     │ description  │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                                              │       │
│         │    MEMORY_TAGS (junction table)             │       │
│         │    memory_id, tag_id                        │       │
│         └──────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### SQLite Schema

```sql
-- memories table: core storage for all remembered information
CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- tags table: categor labels for memories
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

-- memory_tags: many-to-many relationship
CREATE TABLE memory_tags (
    memory_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (memory_id, tag_id),
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- checkpoints table: state snapshots for rollback
CREATE TABLE checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    memory_state_snapshot TEXT NOT NULL,  -- JSON of all memories at this point
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search virtual table for efficient keyword search
CREATE VIRTUAL TABLE memories_fts USING fts5(
    content,
    content='memories',
    content_rowid='id'
);

-- Triggers to keep FTS in sync with memories table
CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.id, old.content);
END;

CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.id, old.content);
    INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
END;

-- Indexes for common queries
CREATE INDEX idx_memories_created ON memories(created_at DESC);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_checkpoints_created ON checkpoints(created_at DESC);
```

---

## MCP Tool Interfaces

### 2.1 remember — Store a memory with tags

**Purpose:** Persist decisions, context, or deliverables with descriptive tags for later retrieval.

**Input Schema:**
```typescript
{
  content: string,      // Required: The memory to store (max 50KB)
  tags?: string[],      // Optional: Tag names (max 10 tags)
  metadata?: {          // Optional: Additional context
    source?: string,   // e.g., "agent-1", "session-2"
    importance?: "low" | "medium" | "high",
    expires_at?: string  // ISO timestamp for auto-expiry
  }
}
```

**Output Schema:**
```typescript
{
  success: true,
  memory_id: number,
  created_at: string,
  tags: string[]
}
```

**Storage Logic:**
1. Insert into `memories` table with content
2. For each tag: insert into `tags` if not exists, get tag_id
3. Insert into `memory_tags` junction table
4. Update FTS index (handled by trigger)
5. Return memory_id and created timestamp

---

### 2.2 recall — Retrieve memories by keyword or similarity

**Purpose:** Find relevant context from previous sessions.

**Input Schema:**
```typescript
{
  query: string,           // Required: Search query (keyword or phrase)
  limit?: number,          // Optional: Max results (default: 10, max: 100)
  tags?: string[],        // Optional: Filter by specific tags
  date_range?: {           // Optional: Filter by date
    start?: string,       // ISO date
    end?: string
  },
  importance?: "low" | "medium" | "high",
  match_strategy?: "keyword" | "semantic"  // Note: semantic requires embeddings
}
```

**Output Schema:**
```typescript
{
  success: true,
  results: Array<{
    memory_id: number,
    content: string,
    tags: string[],
    relevance_score: number,  // 0.0-1.0
    created_at: string,
    updated_at: string
  }>,
  total: number
}
```

**Search Algorithm:**
1. If `match_strategy === "keyword"` or no semantic provider configured:
   - Use FTS5 MATCH for full-text search
   - Rank by BM25 score
2. If `match_strategy === "semantic"`:
   - Use sentence embeddings (requires external provider)
   - Compute cosine similarity
3. Apply tag filters via JOIN
4. Apply date range via WHERE clause
5. Return top `limit` results sorted by relevance

---

### 2.3 rollback — Restore to a previous checkpoint

**Purpose:** Revert memory state to a known-good checkpoint after failures.

**Input Schema:**
```typescript
{
  checkpoint_id: number,   // Required: Which checkpoint to restore
  restore_description?: string  // Optional: Why restoring
}
```

**Output Schema:**
```typescript
{
  success: true,
  checkpoint_id: number,
  restored_at: string,
  memories_restored: number
}
```

**Checkpoint Logic:**
1. Load checkpoint's `memory_state_snapshot` JSON
2. Delete all current memories (cascade removes tags)
3. Re-insert memories from snapshot
4. Create new checkpoint with description "Auto-restore after rollback"
5. Return count of restored memories

---

### 2.4 search — Find specific memories with filters

**Purpose:** Advanced filtering for finding specific memories.

**Input Schema:**
```typescript
{
  query?: string,         // Optional: Keyword search
  tags?: string[],        // Optional: Filter by tags (AND logic)
  date_range?: {
    start?: string,
    end?: string
  },
  sort_by?: "relevance" | "date_desc" | "date_asc",
  limit?: number,
  offset?: number
}
```

**Output Schema:**
```typescript
{
  success: true,
  memories: Array<{
    id: number,
    content: string,
    tags: string[],
    created_at: string,
    updated_at: string
  }>,
  pagination: {
    total: number,
    limit: number,
    offset: number,
    has_more: boolean
  }
}
```

---

## Additional Management Tools

### create_checkpoint — Save current state

```typescript
// Input
{
  description?: string  // Optional note about what's being saved
}

// Output
{
  success: true,
  checkpoint_id: number,
  memories_saved: number,
  created_at: string
}
```

### list_checkpoints — View available restore points

```typescript
// Input
{
  limit?: number,
  offset?: number
}

// Output
{
  success: true,
  checkpoints: Array<{
    id: number,
    description: string,
    memory_count: number,
    created_at: string
  }>
}
```

### delete_memory — Remove a specific memory

```typescript
// Input
{
  memory_id: number
}

// Output
{
  success: true,
  deleted: boolean
}
```

---

## Project Structure

```
mcp-memory-server/
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── config.ts             # Configuration management
│   ├── database/
│   │   ├── index.ts          # Database connection & reset function
│   │   ├── migrations.ts     # Schema initialization with indexes
│   │   └── queries.ts        # Raw SQL queries (optimized with JOINs)
│   ├── services/
│   │   ├── memory.ts         # Memory CRUD operations (with transactions)
│   │   ├── checkpoint.ts     # Checkpoint management
│   │   ├── search.ts         # Search/recall logic
│   │   └── rollback.ts       # Rollback with atomic transactions
│   ├── tools/
│   │   ├── remember.ts       # remember tool implementation
│   │   ├── recall.ts         # recall tool implementation
│   │   ├── rollback.ts       # rollback tool implementation
│   │   ├── search.ts         # search tool implementation
│   │   └── management.ts     # checkpoint/list/delete tools
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── utils/
│       ├── logger.ts         # Structured JSON logging
│       └── validators.ts     # Input validation (comprehensive)
├── tests/
│   └── e2e.test.ts          # End-to-end tests (25 tests)
├── scripts/
│   └── init-db.ts           # Database initialization script
├── data/
│   └── memory.db             # SQLite database file (created at runtime)
├── docs/
│   ├── architecture.md       # This file
│   └── security-audit.md     # Security audit report
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── vitest.config.ts          # Test configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## Configuration & Integration

### Environment Variables (.env.example)

```bash
# Database
DATABASE_PATH=data/memory.db

# Server
PORT=3100
HOST=localhost

# Logging
LOG_LEVEL=info  # debug, info, warn, error

# Optional: Semantic search provider
# EMBEDDINGS_PROVIDER=openai
# OPENAI_API_KEY=your_key_here
```

### MCP Integration (mcp.json)

Place this in your Claude Code configuration directory:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/mcp-memory-server/dist/index.js"],
      "env": {
        "DATABASE_PATH": "/path/to/mcp-memory-server/data/memory.db"
      }
    }
  }
}
```

---

## Implementation Priority

### Phase 1 — Core (MVP)
1. Database schema + migrations
2. `remember` tool (write)
3. `recall` with keyword search (read)
4. `create_checkpoint` / `list_checkpoints` (state management)

### Phase 2 — Essential Features
1. `rollback` tool
2. `search` with filters
3. `delete_memory` tool

### Phase 3 — Enhanced
1. Semantic search with embeddings
2. Importance metadata
3. Auto-expiry for memories

---

## Trade-off Summary

| Decision | Chosen | Trade-off |
|----------|--------|-----------|
| Search strategy | FTS5 keyword | Simple, fast, no external deps. Semantic requires embeddings API |
| Checkpoint style | Full snapshot | Simpler to implement. Delta would save space but adds complexity |
| Tag storage | Normalized (junction table) | More queries for simple cases, but prevents duplication |
| Database | SQLite | Single-writer only. Good for local; not for distributed |

---

## Memory Integration Protocol (for Agents)

To add memory to any agent, include this section in the agent's prompt:

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

---

## References

- [agency-agents MCP Memory Standard](https://github.com/msitarzewski/agency-agents/tree/main/integrations/mcp-memory)
- [Official MCP Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
