import { searchMemories } from '../services/search.js';
import { validateSearchInput } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

export function registerSearchTool() {
  return {
    name: 'search',
    description: 'Find memories with advanced filtering options.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword search query',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (AND logic)',
        },
        date_range: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'ISO date string' },
            end: { type: 'string', description: 'ISO date string' },
          },
        },
        sort_by: {
          type: 'string',
          enum: ['relevance', 'date_desc', 'date_asc'],
          description: 'How to sort results',
          default: 'date_desc',
        },
        limit: {
          type: 'number',
          description: 'Number of results per page (default: 10)',
          default: 10,
        },
        offset: {
          type: 'number',
          description: 'Number of results to skip (for pagination)',
          default: 0,
        },
      },
    },
  };
}

export async function handleSearch(args: unknown): Promise<unknown> {
  const input = validateSearchInput(args);
  logger.debug('Search called', { query: input.query, tags: input.tags });
  return searchMemories(input);
}
