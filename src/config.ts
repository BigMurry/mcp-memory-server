import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const DB_EXTENSIONS = ['.db', '.sqlite', '.sqlite3'];

function isValidDatabasePath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return DB_EXTENSIONS.includes(ext);
}

function validateDatabasePath(dbPath: string): string {
  // Resolve to absolute path
  const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

  // Check for path traversal attempts
  if (absolutePath.includes('..')) {
    throw new Error('Database path cannot contain ".." (path traversal not allowed)');
  }

  // Validate file extension
  if (!isValidDatabasePath(absolutePath)) {
    throw new Error(`Database path must have one of these extensions: ${DB_EXTENSIONS.join(', ')}`);
  }

  // Get the directory and check it's accessible
  const dbDir = path.dirname(absolutePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return absolutePath;
}

function validateConfig(): void {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const validLogLevels = ['debug', 'info', 'warn', 'error'];

  if (!validLogLevels.includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
  }

  // Validate database path
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'memory.db');
  validateDatabasePath(dbPath);

  // Validate port if provided
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('PORT must be a number between 1 and 65535');
    }
  }
}

validateConfig();

export const config = {
  database: {
    path: validateDatabasePath(process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'memory.db')),
  },
  server: {
    port: parseInt(process.env.PORT || '3100', 10),
    host: process.env.HOST || 'localhost',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
