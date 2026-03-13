import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

function validateConfig(): void {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const validLogLevels = ['debug', 'info', 'warn', 'error'];

  if (!validLogLevels.includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
  }

  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'memory.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

validateConfig();

export const config = {
  database: {
    path: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'memory.db'),
  },
  server: {
    port: parseInt(process.env.PORT || '3100', 10),
    host: process.env.HOST || 'localhost',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
