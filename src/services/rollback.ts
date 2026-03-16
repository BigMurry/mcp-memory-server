import * as queries from '../database/queries.js';
import { getDatabase } from '../database/index.js';
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

  // Parse the snapshot with proper error handling
  let snapshot;
  try {
    snapshot = JSON.parse(checkpoint.memory_state_snapshot);
  } catch (e) {
    throw new Error('Failed to parse checkpoint snapshot: invalid JSON format');
  }

  // Get database for atomic transaction
  const db = getDatabase();

  // Perform atomic rollback: delete + restore in single transaction
  const restoredCount = db.transaction(() => {
    // Delete all current memories
    queries.deleteAllMemories();

    // Restore memories using batch insert (much faster than row-by-row)
    return queries.batchInsertMemories(snapshot);
  })();

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
