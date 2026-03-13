import * as queries from '../database/queries.js';
import type { CreateCheckpointInput, CreateCheckpointOutput, ListCheckpointsInput, ListCheckpointsOutput } from '../types/index.js';

export function createCheckpoint(input: CreateCheckpointInput): CreateCheckpointOutput {
  const { description } = input;

  // Get all current memories with their tags
  const memories = queries.getAllMemories();

  // Create snapshot
  const snapshot = JSON.stringify(memories);

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
  const { limit = 10, offset = 0 } = input;

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
