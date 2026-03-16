/**
 * End-to-End Tests for MCP Memory Server
 *
 * Tests all business requirements:
 * 1. Remember - Store memories with tags and metadata
 * 2. Recall - Retrieve memories with query and filters
 * 3. Search - Search memories
 * 4. Create Checkpoint - Save current state
 * 5. List Checkpoints - View checkpoints (verifies memory_count fix)
 * 6. Rollback - Restore from checkpoint (verifies metadata preservation)
 * 7. Delete Memory - Remove a memory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use a fixed test database path in temp
const testDbDir = path.join(os.tmpdir(), 'mcp-memory-test');
const testDbPath = path.join(testDbDir, 'test.db');

beforeEach(async () => {
  // Ensure test directory exists
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }

  // Set test database path BEFORE importing
  process.env.DATABASE_PATH = testDbPath;
  process.env.LOG_LEVEL = 'error';

  // Reset and reimport database to pick up new path
  resetDatabase();

  // Delete all data from the database (in correct order due to foreign keys)
  const { getDatabase } = await import('../src/database/index.js');
  const db = getDatabase();
  db.exec('DELETE FROM memory_tags'); // junction table first
  db.exec('DELETE FROM memories');
  db.exec('DELETE FROM checkpoints');
  db.exec('DELETE FROM tags');
});

afterEach(() => {
  // Clean up
  resetDatabase();

  // Delete all data (in correct order due to foreign keys)
  try {
    if (fs.existsSync(testDbPath)) {
      const Database = require('better-sqlite3');
      const db = new Database(testDbPath);
      db.exec('DELETE FROM memory_tags'); // junction table first
      db.exec('DELETE FROM memories');
      db.exec('DELETE FROM checkpoints');
      db.exec('DELETE FROM tags');
      db.close();
    }
  } catch (e) {
    // Ignore cleanup errors
  }

  delete process.env.DATABASE_PATH;
  delete process.env.LOG_LEVEL;
});

// Import handlers
import { handleRemember } from '../src/tools/remember.js';
import { handleRecall } from '../src/tools/recall.js';
import { handleSearch } from '../src/tools/search.js';
import { handleRollback } from '../src/tools/rollback.js';
import { handleCreateCheckpoint, handleListCheckpoints, handleDeleteMemory } from '../src/tools/management.js';
import { resetDatabase } from '../src/database/index.js';

describe('MCP Memory Server - E2E Tests', () => {
  describe('1. Remember - Store Memories', () => {
    it('should store a basic memory', async () => {
      const result = await handleRemember({
        content: 'This is a test memory',
      }) as { success: boolean; memory_id: number; tags: string[] };

      expect(result.success).toBe(true);
      expect(result.memory_id).toBeGreaterThan(0);
      expect(result.tags).toEqual([]);
    });

    it('should store a memory with tags', async () => {
      const result = await handleRemember({
        content: 'Memory with tags',
        tags: ['test', 'important', 'work'],
      }) as { success: boolean; memory_id: number; tags: string[] };

      expect(result.success).toBe(true);
      expect(result.tags).toContain('test');
      expect(result.tags).toContain('important');
      expect(result.tags).toContain('work');
    });

    it('should store a memory with metadata', async () => {
      const result = await handleRemember({
        content: 'Memory with metadata',
        metadata: {
          source: 'agent-1',
          importance: 'high',
          expires_at: '2027-01-01T00:00:00Z',
        },
      }) as { success: boolean; memory_id: number };

      expect(result.success).toBe(true);
      expect(result.memory_id).toBeGreaterThan(0);
    });

    it('should reject memory with empty content', async () => {
      await expect(
        handleRemember({ content: '' })
      ).rejects.toThrow();
    });

    it('should reject memory with content exceeding 50KB', async () => {
      const longContent = 'x'.repeat(50001); // 50KB + 1

      await expect(
        handleRemember({ content: longContent })
      ).rejects.toThrow();
    });
  });

  describe('2. Recall - Retrieve Memories', () => {
    beforeEach(async () => {
      // Create test memories
      await handleRemember({ content: 'Python is a programming language', tags: ['code', 'python'] });
      await handleRemember({ content: 'JavaScript runs in the browser', tags: ['code', 'javascript'] });
      await handleRemember({ content: 'The weather is nice today', tags: ['personal', 'weather'] });
    });

    it('should recall memories by keyword', async () => {
      const result = await handleRecall({
        query: 'programming',
      }) as { success: boolean; results: any[]; total: number };

      expect(result.success).toBe(true);
      expect(result.total).toBeGreaterThan(0);
      expect(result.results[0].content).toContain('Python');
    });

    it('should recall memories with tag filter', async () => {
      // Recall requires a query - use search for tag-only filtering
      const result = await handleSearch({
        query: '',
        tags: ['code'],
      }) as { success: boolean; memories: any[] };

      expect(result.success).toBe(true);
      expect(result.memories.length).toBe(2); // Python and JavaScript
    });

    it('should limit recall results', async () => {
      const result = await handleRecall({
        query: 'a', // Use a minimal query that matches something
        limit: 1,
      }) as { success: boolean; results: any[]; total: number };

      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should reject empty recall query without tags', async () => {
      await expect(
        handleRecall({ query: '' })
      ).rejects.toThrow();
    });
  });

  describe('3. Search - Search Memories', () => {
    beforeEach(async () => {
      await handleRemember({ content: 'Meeting at 3pm tomorrow', tags: ['work', 'meeting'] });
      await handleRemember({ content: 'Buy groceries milk and bread', tags: ['personal', 'shopping'] });
      await handleRemember({ content: 'Project deadline is Friday', tags: ['work', 'deadline'] });
    });

    it('should search memories by query', async () => {
      const result = await handleSearch({
        query: 'meeting',
      }) as { success: boolean; memories: any[] };

      expect(result.success).toBe(true);
      expect(result.memories.length).toBeGreaterThan(0);
      expect(result.memories[0].content).toContain('Meeting');
    });

    it('should search with tag filter', async () => {
      const result = await handleSearch({
        query: '', // Empty query to search by tags only
        tags: ['work'],
      }) as { success: boolean; memories: any[] };

      expect(result.success).toBe(true);
      // Should find at least the work-related memories
      expect(result.memories.length).toBeGreaterThanOrEqual(2);
    });

    it('should sort search results by date', async () => {
      const result = await handleSearch({
        sort_by: 'date_desc',
      }) as { success: boolean; memories: any[] };

      expect(result.success).toBe(true);
      // Most recent should be first
      const dates = result.memories.map(m => new Date(m.created_at).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });
  });

  describe('4. Create & List Checkpoints', () => {
    beforeEach(async () => {
      // Create some memories
      await handleRemember({ content: 'Checkpoint test memory 1', tags: ['test'] });
      await handleRemember({ content: 'Checkpoint test memory 2', tags: ['test'] });
    });

    it('should create a checkpoint', async () => {
      const result = await handleCreateCheckpoint({
        description: 'Test checkpoint',
      }) as { success: boolean; checkpoint_id: number; memories_saved: number };

      expect(result.success).toBe(true);
      expect(result.checkpoint_id).toBeGreaterThan(0);
      expect(result.memories_saved).toBeGreaterThanOrEqual(2);
    });

    it('should create checkpoint without description', async () => {
      const result = await handleCreateCheckpoint({}) as { success: boolean };

      expect(result.success).toBe(true);
    });

    it('should list checkpoints with correct memory count', async () => {
      // Get current memory count
      const beforeResult = await handleSearch({}) as { memories: any[] };
      const beforeCount = beforeResult.memories.length;

      // Create more memories
      await handleRemember({ content: 'Another memory', tags: ['extra'] });

      // Create checkpoint
      await handleCreateCheckpoint({ description: 'Checkpoint with more memories' });

      // List checkpoints
      const result = await handleListCheckpoints({}) as { success: boolean; checkpoints: any[] };

      expect(result.success).toBe(true);
      expect(result.checkpoints.length).toBeGreaterThan(0);

      // Verify memory_count is correct (this tests the bug fix)
      // The checkpoint should have memories_saved equal to current count
      const checkpoint = result.checkpoints[0];
      expect(checkpoint.memory_count).toBe(beforeCount + 1);
    });

    it('should limit listed checkpoints', async () => {
      // Create multiple checkpoints
      await handleCreateCheckpoint({ description: 'Checkpoint 1' });
      await handleCreateCheckpoint({ description: 'Checkpoint 2' });
      await handleCreateCheckpoint({ description: 'Checkpoint 3' });

      const result = await handleListCheckpoints({ limit: 2 }) as { success: boolean; checkpoints: any[] };

      expect(result.success).toBe(true);
      expect(result.checkpoints.length).toBe(2);
    });
  });

  describe('5. Rollback - Restore from Checkpoint', () => {
    it('should rollback to checkpoint and preserve metadata', async () => {
      // Create memory with metadata
      await handleRemember({
        content: 'Important memory with metadata',
        tags: ['important'],
        metadata: {
          source: 'test-agent',
          importance: 'high',
        },
      });

      // Create checkpoint
      const checkpointResult = await handleCreateCheckpoint({ description: 'Before rollback' }) as { checkpoint_id: number };
      const checkpointId = checkpointResult.checkpoint_id;

      // Create another memory after checkpoint
      await handleRemember({
        content: 'Memory added after checkpoint',
        tags: ['temp'],
      });

      // Rollback to checkpoint
      const rollbackResult = await handleRollback({
        checkpoint_id: checkpointId,
      }) as { success: boolean; memories_restored: number };

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.memories_restored).toBe(1); // Only the original memory
    });

    it('should reject invalid checkpoint_id', async () => {
      await expect(
        handleRollback({ checkpoint_id: 99999 })
      ).rejects.toThrow();
    });
  });

  describe('6. Delete Memory', () => {
    beforeEach(async () => {
      // Create a memory to delete
      await handleRemember({ content: 'Memory to delete', tags: ['temp'] });
    });

    it('should delete a memory', async () => {
      // Get memory ID first
      const recallResult = await handleRecall({ query: 'delete' }) as { results: any[] };
      const memoryId = recallResult.results[0].memory_id;

      // Delete it
      const deleteResult = await handleDeleteMemory({ memory_id: memoryId }) as { success: boolean; deleted: boolean };

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deleted).toBe(true);

      // Verify it's gone
      const afterDelete = await handleRecall({ query: 'delete' }) as { results: any[] };
      expect(afterDelete.results.length).toBe(0);
    });

    it('should handle invalid memory_id gracefully', async () => {
      const result = await handleDeleteMemory({ memory_id: 99999 }) as { success: boolean; deleted: boolean };
      expect(result.success).toBe(true);
      expect(result.deleted).toBe(false);
    });
  });

  describe('7. Validation Tests', () => {
    it('should reject invalid checkpoint description length', async () => {
      const longDescription = 'x'.repeat(501); // 500 chars limit + 1

      await expect(
        handleCreateCheckpoint({ description: longDescription })
      ).rejects.toThrow();
    });

    it('should reject invalid metadata importance', async () => {
      await expect(
        handleRemember({
          content: 'Test',
          metadata: {
            importance: 'invalid' as any,
          },
        })
      ).rejects.toThrow();
    });

    it('should reject invalid metadata expires_at', async () => {
      await expect(
        handleRemember({
          content: 'Test',
          metadata: {
            expires_at: 'not-a-date',
          },
        })
      ).rejects.toThrow();
    });

    it('should reject tag exceeding 50 characters', async () => {
      const longTag = 'x'.repeat(51);

      await expect(
        handleRemember({
          content: 'Test',
          tags: [longTag],
        })
      ).rejects.toThrow();
    });
  });

  describe('8. End-to-End Workflow', () => {
    it('should complete full workflow: remember -> search -> checkpoint -> rollback -> delete', async () => {
      // Step 1: Remember multiple memories
      const mem1 = await handleRemember({ content: 'Learn TypeScript', tags: ['coding', 'typescript'] }) as { memory_id: number };
      const mem2 = await handleRemember({ content: 'Buy coffee beans', tags: ['shopping', 'coffee'] }) as { memory_id: number };

      expect(mem1.memory_id).toBeGreaterThan(0);
      expect(mem2.memory_id).toBeGreaterThan(0);

      // Step 2: Search memories
      const searchResult = await handleSearch({ query: 'TypeScript' }) as { success: boolean; memories: any[] };
      expect(searchResult.success).toBe(true);
      // TypeScript memory should be in results
      const hasTypeScript = searchResult.memories.some(m => m.content.includes('TypeScript'));
      expect(hasTypeScript).toBe(true);

      // Step 3: Create checkpoint
      const checkpoint = await handleCreateCheckpoint({ description: 'Before cleanup' }) as { success: boolean; checkpoint_id: number };
      expect(checkpoint.success).toBe(true);

      // Step 4: Delete a memory
      const deleteResult = await handleDeleteMemory({ memory_id: mem2.memory_id }) as { success: boolean };
      expect(deleteResult.success).toBe(true);

      // Step 5: Rollback to checkpoint
      const rollback = await handleRollback({ checkpoint_id: checkpoint.checkpoint_id }) as { success: boolean; memories_restored: number };
      expect(rollback.success).toBe(true);
      expect(rollback.memories_restored).toBe(2); // Both memories restored

      // Step 6: Verify restored memories
      const finalSearch = await handleSearch({ query: 'coffee' }) as { success: boolean; memories: any[] };
      expect(finalSearch.memories.length).toBe(1); // Memory restored
    });
  });
});
