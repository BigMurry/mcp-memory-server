import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getDatabase, closeDatabase } from './database/index.js';
import { logger } from './utils/logger.js';
import { ValidationError } from './utils/validators.js';

// Import tool definitions
import { registerRememberTool, handleRemember } from './tools/remember.js';
import { registerRecallTool, handleRecall } from './tools/recall.js';
import { registerSearchTool, handleSearch } from './tools/search.js';
import { registerRollbackTool, handleRollback } from './tools/rollback.js';
import {
  registerCreateCheckpointTool,
  handleCreateCheckpoint,
  registerListCheckpointsTool,
  handleListCheckpoints,
  registerDeleteMemoryTool,
  handleDeleteMemory,
} from './tools/management.js';

class MemoryServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-memory-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          registerRememberTool(),
          registerRecallTool(),
          registerSearchTool(),
          registerRollbackTool(),
          registerCreateCheckpointTool(),
          registerListCheckpointsTool(),
          registerDeleteMemoryTool(),
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: unknown;

        switch (name) {
          case 'remember':
            result = await handleRemember(args);
            break;
          case 'recall':
            result = await handleRecall(args);
            break;
          case 'search':
            result = await handleSearch(args);
            break;
          case 'rollback':
            result = await handleRollback(args);
            break;
          case 'create_checkpoint':
            result = await handleCreateCheckpoint(args);
            break;
          case 'list_checkpoints':
            result = await handleListCheckpoints(args);
            break;
          case 'delete_memory':
            result = await handleDeleteMemory(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isValidationError = error instanceof ValidationError;

        logger.error(`Tool error: ${name}`, {
          tool: name,
          error: errorMessage,
          validation: isValidationError,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: errorMessage,
                type: isValidationError ? 'validation' : 'internal',
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    // Initialize database
    try {
      getDatabase();
    } catch (error) {
      logger.error('Failed to initialize database', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('MCP Memory Server started');
  }
}

// Start server
const server = new MemoryServer();

server.run().catch((error) => {
  logger.error('Failed to start server', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});

// Graceful shutdown handlers
async function shutdown(signal: string) {
  logger.info('Received shutdown signal', { signal });

  try {
    closeDatabase();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});
