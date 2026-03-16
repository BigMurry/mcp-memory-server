import { getDatabase } from './index.js';
import type { MemoryWithTags } from '../types/index.js';

// Memory queries - optimized with JOIN to avoid N+1 queries
export function getAllMemoriesWithTags(): MemoryWithTags[] {
  const db = getDatabase();
  const memories = db.prepare(`
    SELECT
      m.id, m.content, m.metadata, m.created_at, m.updated_at,
      GROUP_CONCAT(t.name) as tags_concat
    FROM memories m
    LEFT JOIN memory_tags mt ON m.id = mt.memory_id
    LEFT JOIN tags t ON mt.tag_id = t.id
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `).all() as any[];
  return memories.map(m => ({
    ...m,
    tags: m.tags_concat ? m.tags_concat.split(',') : [],
  }));
}

export function getAllMemoriesLimitedWithTags(limit: number): MemoryWithTags[] {
  const db = getDatabase();
  const memories = db.prepare(`
    SELECT
      m.id, m.content, m.metadata, m.created_at, m.updated_at,
      GROUP_CONCAT(t.name) as tags_concat
    FROM memories m
    LEFT JOIN memory_tags mt ON m.id = mt.memory_id
    LEFT JOIN tags t ON mt.tag_id = t.id
    GROUP BY m.id
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(limit) as any[];
  return memories.map(m => ({
    ...m,
    tags: m.tags_concat ? m.tags_concat.split(',') : [],
  }));
}

export function getMemoryByIdWithTags(id: number): MemoryWithTags | null {
  const db = getDatabase();
  const memory = db.prepare(`
    SELECT
      m.id, m.content, m.metadata, m.created_at, m.updated_at,
      GROUP_CONCAT(t.name) as tags_concat
    FROM memories m
    LEFT JOIN memory_tags mt ON m.id = mt.memory_id
    LEFT JOIN tags t ON mt.tag_id = t.id
    WHERE m.id = ?
    GROUP BY m.id
  `).get(id) as any;
  if (!memory) return null;
  return {
    ...memory,
    tags: memory.tags_concat ? memory.tags_concat.split(',') : [],
  };
}

// Legacy functions for backward compatibility - now use optimized JOIN queries
export function insertMemory(content: string, metadata?: string): number {
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO memories (content, metadata) VALUES (?, ?)');
  const result = stmt.run(content, metadata || null);
  return result.lastInsertRowid as number;
}

export function getMemoryById(id: number): MemoryWithTags | null {
  // Use optimized JOIN query instead of N+1
  return getMemoryByIdWithTags(id);
}

export function getAllMemories(): MemoryWithTags[] {
  // Use optimized JOIN query instead of N+1
  return getAllMemoriesWithTags();
}

export function getAllMemoriesLimited(limit: number = 1000): MemoryWithTags[] {
  // Use optimized JOIN query instead of N+1
  return getAllMemoriesLimitedWithTags(limit);
}

export function deleteMemoryById(id: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM memories WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function deleteAllMemories(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM memories').run();
}

// Tag queries
export function getOrCreateTag(name: string): number {
  const db = getDatabase();
  const normalizedName = name.toLowerCase().trim();

  // Use INSERT OR IGNORE to atomically handle race conditions
  // This prevents TOCTOU race between SELECT and INSERT
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(normalizedName);

  // Now get the tag (it must exist after INSERT OR IGNORE)
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(normalizedName) as { id: number };
  return existing.id;
}

export function addTagToMemory(memoryId: number, tagId: number): void {
  const db = getDatabase();
  try {
    db.prepare('INSERT INTO memory_tags (memory_id, tag_id) VALUES (?, ?)').run(memoryId, tagId);
  } catch (e: any) {
    // Ignore duplicate key errors - check for specific SQLite error code
    // SQLITE_CONSTRAINT_UNIQUE = 1555, SQLITE_CONSTRAINT_PRIMARYKEY = 1555
    if (e.code !== 'SQLITE_CONSTRAINT_UNIQUE' && e.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      throw e;
    }
    // Duplicate entry is expected and safe to ignore
  }
}

export function removeTagsFromMemory(memoryId: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM memory_tags WHERE memory_id = ?').run(memoryId);
}

// Optimized search queries for tag-only and date-range filtering

export function getMemoriesWithTagsAndDateFilter(
  startDate?: string,
  endDate?: string,
  limit: number = 1000
): MemoryWithTags[] {
  const db = getDatabase();

  let whereClause = '';
  const params: any[] = [];

  if (startDate) {
    whereClause += 'WHERE m.created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereClause += whereClause ? ' AND m.created_at <= ?' : 'WHERE m.created_at <= ?';
    params.push(endDate);
  }

  const sql = `
    SELECT
      m.id, m.content, m.metadata, m.created_at, m.updated_at,
      GROUP_CONCAT(t.name) as tags_concat
    FROM memories m
    LEFT JOIN memory_tags mt ON m.id = mt.memory_id
    LEFT JOIN tags t ON mt.tag_id = t.id
    ${whereClause}
    GROUP BY m.id
    ORDER BY m.created_at DESC
    LIMIT ?
  `;

  params.push(limit);
  const memories = db.prepare(sql).all(...params) as any[];
  return memories.map(m => ({
    ...m,
    tags: m.tags_concat ? m.tags_concat.split(',') : [],
  }));
}

export function getMemoriesByTags(
  tags: string[],
  limit: number = 1000
): MemoryWithTags[] {
  const db = getDatabase();
  const normalizedTags = tags.map(t => t.toLowerCase());
  const placeholders = normalizedTags.map(() => '?').join(',');

  const sql = `
    SELECT
      m.id, m.content, m.metadata, m.created_at, m.updated_at,
      GROUP_CONCAT(t.name) as tags_concat
    FROM memories m
    JOIN memory_tags mt ON m.id = mt.memory_id
    JOIN tags t ON mt.tag_id = t.id
    WHERE t.name IN (${placeholders})
    GROUP BY m.id
    HAVING COUNT(DISTINCT t.name) = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `;

  const params: any[] = [...normalizedTags, tags.length, limit];
  const memories = db.prepare(sql).all(...params) as any[];
  return memories.map(m => ({
    ...m,
    tags: m.tags_concat ? m.tags_concat.split(',') : [],
  }));
}

// Batch insert for checkpoint restore
export function batchInsertMemories(
  memories: Array<{ content: string; metadata?: string; tags: string[] }>
): number {
  const db = getDatabase();
  let insertedCount = 0;

  const insertMemoryStmt = db.prepare('INSERT INTO memories (content, metadata) VALUES (?, ?)');
  const insertTagStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTagIdStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
  const insertMemoryTagStmt = db.prepare('INSERT INTO memory_tags (memory_id, tag_id) VALUES (?, ?)');

  const transaction = db.transaction(() => {
    for (const memory of memories) {
      const result = insertMemoryStmt.run(memory.content, memory.metadata || null);
      const memoryId = result.lastInsertRowid as number;

      // Create or get tags
      for (const tagName of memory.tags) {
        const normalizedTag = tagName.toLowerCase().trim();
        insertTagStmt.run(normalizedTag);
        const tag = getTagIdStmt.get(normalizedTag) as { id: number };
        insertMemoryTagStmt.run(memoryId, tag.id);
      }

      insertedCount++;
    }
  });

  transaction();
  return insertedCount;
}

// Checkpoint queries
export function createCheckpoint(description: string | null, snapshot: string): number {
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO checkpoints (description, memory_state_snapshot) VALUES (?, ?)');
  const result = stmt.run(description, snapshot);
  return result.lastInsertRowid as number;
}

export function getCheckpointById(id: number): any {
  const db = getDatabase();
  return db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id);
}

export function getAllCheckpoints(limit: number = 10, offset: number = 0): any[] {
  const db = getDatabase();
  // Count memories from the JSON snapshot for each checkpoint
  return db.prepare(`
    SELECT c.*, (
      SELECT COUNT(*) FROM json_each(c.memory_state_snapshot)
    ) as memory_count
    FROM checkpoints c
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

export function getLatestCheckpoint(): any {
  const db = getDatabase();
  return db.prepare('SELECT * FROM checkpoints ORDER BY created_at DESC LIMIT 1').get();
}

// Search queries
export function searchMemoriesFTS(
  query: string,
  limit: number = 10,
  tags?: string[]
): any[] {
  const db = getDatabase();

  // Format query for FTS5 - escape special chars and add wildcards for partial matches
  // FTS5 special chars: * - : ^ ( ) " { } [ ] ~ AND OR NOT
  const ftsSpecialChars = /[*\-:\^()\"\{\}\[\]~]/g;
  const ftsQuery = query
    .replace(ftsSpecialChars, ' ') // Replace special chars with space
    .replace(/['"]/g, '') // Remove quotes
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => `"${w}"*`) // Add wildcard for prefix matching
    .join(' ');

  let sql = `
    SELECT m.*, bm25(memories_fts) as rank
    FROM memories m
    JOIN memories_fts fts ON m.id = fts.rowid
    WHERE memories_fts MATCH ?
  `;

  const params: any[] = [ftsQuery];

  if (tags && tags.length > 0) {
    const placeholders = tags.map(() => '?').join(',');
    sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories m
      JOIN memories_fts fts ON m.id = fts.rowid
      JOIN memory_tags mt ON m.id = mt.memory_id
      JOIN tags t ON mt.tag_id = t.id
      WHERE memories_fts MATCH ? AND t.name IN (${placeholders})
      GROUP BY m.id
    `;
    params.push(...tags.map(t => t.toLowerCase()));
  }

  sql += ' ORDER BY rank LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}
