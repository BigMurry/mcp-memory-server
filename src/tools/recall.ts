import { recallMemories } from '../services/search.js';
import { validateRecallInput } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

export function registerRecallTool() {
  return {
    name: 'recall',
    description: 'Search memories by keyword to find relevant context from previous sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (keyword or phrase)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10, max: 100)',
          default: 10,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific tags',
        },
        date_range: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'ISO date string' },
            end: { type: 'string', description: 'ISO date string' },
          },
        },
        match_strategy: {
          type: 'string',
          enum: ['keyword', 'semantic'],
          description: 'Search strategy: keyword uses full-text search, semantic requires embeddings',
          default: 'keyword',
        },
      },
      required: ['query'],
    },
  };
}

export async function handleRecall(args: unknown): Promise<unknown> {
  const input = validateRecallInput(args);
  logger.debug('Recall called', { query: input.query, limit: input.limit });
  return recallMemories(input);
}
