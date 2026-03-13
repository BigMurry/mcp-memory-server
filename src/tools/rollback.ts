import { rollbackToCheckpoint } from '../services/rollback.js';
import { validateRollbackInput } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

export function registerRollbackTool() {
  return {
    name: 'rollback',
    description: 'Restore memory state to a previous checkpoint. Use this when something fails and you need to recover.',
    inputSchema: {
      type: 'object',
      properties: {
        checkpoint_id: {
          type: 'number',
          description: 'The ID of the checkpoint to restore to',
        },
        restore_description: {
          type: 'string',
          description: 'Optional description of why this restore is happening',
        },
      },
      required: ['checkpoint_id'],
    },
  };
}

export async function handleRollback(args: unknown): Promise<unknown> {
  const input = validateRollbackInput(args);
  logger.info('Rollback called', { checkpoint_id: input.checkpoint_id });
  return rollbackToCheckpoint(input);
}
