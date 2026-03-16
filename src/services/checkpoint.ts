import * as queries from '../database/queries.js';
import type { CreateCheckpointInput, CreateCheckpointOutput, ListCheckpointsInput, ListCheckpointsOutput } from '../types/index.js';
import { ValidationError } from '../utils/validators.js';

// Resource limits
const MAX_CHECKPOINT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CHECKPOINTS_LIMIT = 100;
const MAX_CHECKPOINTS_OFFSET = 1000;

export function createCheckpoint(input: CreateCheckpointInput): CreateCheckpointOutput {
  const { description } = input;

  // Get all current memories with their tags
  const memories = queries.getAllMemories();

  // Create snapshot
  const snapshot = JSON.stringify(memories);

  // Check snapshot size
  if (snapshot.length > MAX_CHECKPOINT_SIZE) {
    throw new ValidationError(`Checkpoint too large (max ${MAX_CHECKPOINT_SIZE / 1024 / 1024}MB). Consider deleting some memories.`);
  }

  // Save checkpoint
  const checkpointId = queries.createCheckpoint(description || null, snapshot);

  return {
    success: true,
    checkpoint_id: checkpointId,
    memories_saved: memories.length,
    created_at: new Date().toISOString(),
  };
}

export function listCheckpoints(input: ListCheckpointsInput): ListCheckpointsOutput {
  let { limit = 10, offset = 0 } = input;

  // Enforce limits
  if (limit > MAX_CHECKPOINTS_LIMIT) {
    limit = MAX_CHECKPOINTS_LIMIT;
  }
  if (offset > MAX_CHECKPOINTS_OFFSET) {
    offset = MAX_CHECKPOINTS_OFFSET;
  }

  const checkpoints = queries.getAllCheckpoints(limit, offset);

  return {
    success: true,
    checkpoints: checkpoints.map(c => ({
      id: c.id,
      description: c.description || '',
      memory_count: c.memory_count || 0,
      created_at: c.created_at,
    })),
  };
}

export function getCheckpoint(id: number) {
  return queries.getCheckpointById(id);
}
