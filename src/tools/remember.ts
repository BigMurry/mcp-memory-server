import { createMemory } from '../services/memory.js';
import { validateRememberInput } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

export function registerRememberTool() {
  return {
    name: 'remember',
    description: 'Store a memory with tags for later retrieval. Use this to remember decisions, context, or deliverables.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory content to store (max 50KB)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tag names to associate with this memory (max 10)',
        },
        metadata: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'e.g., "agent-1", "session-2"' },
            importance: { type: 'string', enum: ['low', 'medium', 'high'] },
            expires_at: { type: 'string', description: 'ISO timestamp for auto-expiry' },
          },
        },
      },
      required: ['content'],
    },
  };
}

export async function handleRemember(args: unknown): Promise<unknown> {
  const input = validateRememberInput(args);
  logger.debug('Remember called', { tags: input.tags });
  return createMemory(input);
}
