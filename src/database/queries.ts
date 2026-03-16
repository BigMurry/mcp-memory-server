import { getDatabase } from './index.js';
import type { MemoryWithTags } from '../types/index.js';

// Memory queries
export function insertMemory(content: string, metadata?: string): number {
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO memories (content, metadata) VALUES (?, ?)');
  const result = stmt.run(content, metadata || null);
  return result.lastInsertRowid as number;
}

export function getMemoryById(id: number): MemoryWithTags | null {
  const db = getDatabase();
  const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
  if (!memory) return null;

  const tags = getTagsForMemory(id);
  return { ...memory, tags };
}

export function getAllMemories(): MemoryWithTags[] {
  const db = getDatabase();
  const memories = db.prepare('SELECT * FROM memories ORDER BY created_at DESC').all() as any[];
  return memories.map(m => ({
    ...m,
    tags: getTagsForMemory(m.id),
  }));
}

export function getAllMemoriesLimited(limit: number = 1000): MemoryWithTags[] {
  const db = getDatabase();
  const memories = db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
  return memories.map(m => ({
    ...m,
    tags: getTagsForMemory(m.id),
  }));
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

  // Try to find existing tag
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(normalizedName) as { id: number } | undefined;
  if (existing) return existing.id;

  // Create new tag
  const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(normalizedName);
  return result.lastInsertRowid as number;
}

export function getTagsForMemory(memoryId: number): string[] {
  const db = getDatabase();
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN memory_tags mt ON t.id = mt.tag_id
    WHERE mt.memory_id = ?
  `).all(memoryId) as { name: string }[];
  return tags.map(t => t.name);
}

export function addTagToMemory(memoryId: number, tagId: number): void {
  const db = getDatabase();
  try {
    db.prepare('INSERT INTO memory_tags (memory_id, tag_id) VALUES (?, ?)').run(memoryId, tagId);
  } catch (e: any) {
    // Ignore duplicate key errors
    if (!e.message.includes('UNIQUE constraint failed')) {
      throw e;
    }
  }
}

export function removeTagsFromMemory(memoryId: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM memory_tags WHERE memory_id = ?').run(memoryId);
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
  return db.prepare(`
    SELECT c.*, COUNT(m.id) as memory_count
    FROM checkpoints c
    LEFT JOIN (
      SELECT DISTINCT memory_id FROM memory_tags
    ) mt ON 1=1
    LEFT JOIN memories m ON 1=1
    GROUP BY c.id
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
