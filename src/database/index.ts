import Database from 'better-sqlite3';
import { config } from '../config.js';
import { runMigrations } from './migrations.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = config.database.path;
    const dataDir = path.dirname(dbPath);

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    logger.info('Opening database', { path: dbPath });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    runMigrations(db);
    logger.info('Database initialized', { path: dbPath });
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    logger.info('Closing database');
    db.close();
    db = null;
  }
}
