import {
  destroyPostgresTestDatabase,
  getAppliedTestMigrations,
  initializePostgresTestDatabase,
} from './postgres-test-database';

async function main(): Promise<void> {
  try {
    await initializePostgresTestDatabase();
    console.info(
      `PostgreSQL test database is ready; ${getAppliedTestMigrations().length} registered migration(s) applied.`,
    );
  } finally {
    await destroyPostgresTestDatabase();
  }
}

void main();
