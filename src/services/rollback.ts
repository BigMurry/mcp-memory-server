import * as queries from '../database/queries.js';
import * as memoryService from './memory.js';
import * as checkpointService from './checkpoint.js';
import type { RollbackInput, RollbackOutput } from '../types/index.js';

export function rollbackToCheckpoint(input: RollbackInput): RollbackOutput {
  const { checkpoint_id, restore_description } = input;

  if (!checkpoint_id) {
    throw new Error('checkpoint_id is required');
  }

  // Get the checkpoint
  const checkpoint = checkpointService.getCheckpoint(checkpoint_id);
  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpoint_id} not found`);
  }

  // Parse the snapshot
  const snapshot = JSON.parse(checkpoint.memory_state_snapshot);

  // Delete all current memories
  queries.deleteAllMemories();

  // Restore memories from snapshot
  let restoredCount = 0;
  for (const memory of snapshot) {
    memoryService.createMemory({
      content: memory.content,
      tags: memory.tags || [],
    });
    restoredCount++;
  }

  // Create a new checkpoint to record this restore
  checkpointService.createCheckpoint({
    description: restore_description || `Restored from checkpoint ${checkpoint_id}`,
  });

  return {
    success: true,
    checkpoint_id,
    restored_at: new Date().toISOString(),
    memories_restored: restoredCount,
  };
}
