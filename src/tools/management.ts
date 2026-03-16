import { createCheckpoint, listCheckpoints } from '../services/checkpoint.js';
import { deleteMemory } from '../services/memory.js';
import { validateDeleteMemoryInput, validateCreateCheckpointInput, validateListCheckpointsInput } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

export function registerCreateCheckpointTool() {
  return {
    name: 'create_checkpoint',
    description: 'Save current memory state as a checkpoint for potential rollback.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Optional note about what is being saved',
        },
      },
    },
  };
}

export async function handleCreateCheckpoint(args: unknown): Promise<unknown> {
  const input = validateCreateCheckpointInput(args);
  logger.info('Create checkpoint called', { description: input.description });
  return createCheckpoint({ description: input.description });
}

export function registerListCheckpointsTool() {
  return {
    name: 'list_checkpoints',
    description: 'List all available checkpoints for rollback.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of checkpoints to return (default: 10)',
          default: 10,
        },
        offset: {
          type: 'number',
          description: 'Number of checkpoints to skip',
          default: 0,
        },
      },
    },
  };
}

export async function handleListCheckpoints(args: unknown): Promise<unknown> {
  const input = validateListCheckpointsInput(args);
  return listCheckpoints(input);
}

export function registerDeleteMemoryTool() {
  return {
    name: 'delete_memory',
    description: 'Delete a specific memory by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: {
          type: 'number',
          description: 'The ID of the memory to delete',
        },
      },
      required: ['memory_id'],
    },
  };
}

export async function handleDeleteMemory(args: unknown): Promise<unknown> {
  const input = validateDeleteMemoryInput(args);
  logger.info('Delete memory called', { memory_id: input.memory_id });
  return deleteMemory(input);
}
