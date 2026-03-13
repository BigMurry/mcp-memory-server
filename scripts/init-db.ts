import { getDatabase, closeDatabase } from '../src/database/index.js';

console.log('Initializing database...');

try {
  const db = getDatabase();
  console.log('Database initialized successfully');
  console.log(`Database location: ${db.name}`);

  // Verify tables exist
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table'
  `).all();

  console.log('Tables created:');
  tables.forEach((t: any) => console.log(`  - ${t.name}`));

  closeDatabase();
  console.log('Database ready!');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}
