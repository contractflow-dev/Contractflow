import { createMigrationDataSource } from '../../../src/common/database/data-source';
import type { DataSource, DataSourceOptions } from 'typeorm';
import { getTestDatabaseName, getTestDatabaseUrl } from './database-safety';

let dataSource: DataSource | undefined;
let initialization: Promise<DataSource> | undefined;
let appliedMigrations: string[] = [];

export async function initializePostgresTestDatabase(
  entities?: DataSourceOptions['entities'],
): Promise<DataSource> {
  if (dataSource?.isInitialized) return dataSource;
  if (initialization) return initialization;

  initialization = initialize(entities);
  try {
    return await initialization;
  } finally {
    initialization = undefined;
  }
}

async function initialize(
  entities?: DataSourceOptions['entities'],
): Promise<DataSource> {
  const databaseUrl = getTestDatabaseUrl();
  const expectedDatabaseName = getTestDatabaseName(databaseUrl);
  const candidate = createMigrationDataSource(databaseUrl, entities);

  if (candidate.options.type !== 'postgres') {
    throw new Error(
      'PostgreSQL integration tests require a PostgreSQL DataSource.',
    );
  }
  if (candidate.options.synchronize || candidate.options.migrationsRun) {
    throw new Error(
      'PostgreSQL integration tests require synchronization and automatic migrations to be disabled.',
    );
  }

  let stage = 'database connection';
  try {
    await candidate.initialize();
    stage = 'database identity verification';
    const [{ database_name: connectedDatabaseName }] = (await candidate.query(
      'SELECT current_database() AS database_name',
    )) as Array<{ database_name: string }>;
    if (connectedDatabaseName !== expectedDatabaseName) {
      throw new Error(
        'The PostgreSQL server connected to a different database.',
      );
    }

    stage = 'registered migrations';
    const migrations = await candidate.runMigrations();
    stage = 'post-migration verification';
    await candidate.query('SELECT 1');
    appliedMigrations = migrations.map(({ name }) => name);
    dataSource = candidate;
    return candidate;
  } catch (error) {
    if (candidate.isInitialized) {
      await candidate.destroy();
    }
    const failure = getSafeFailureDetails(error);
    throw new Error(
      `PostgreSQL test database setup failed during ${stage}${failure}. Verify TEST_DATABASE_URL, database permissions, and migration state; connection details are suppressed.`,
    );
  }
}

function getSafeFailureDetails(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';

  const name =
    'name' in error && typeof error.name === 'string' ? error.name : undefined;
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : undefined;
  const driverError =
    'driverError' in error &&
    typeof error.driverError === 'object' &&
    error.driverError !== null
      ? error.driverError
      : undefined;
  const driverCode =
    driverError && 'code' in driverError && typeof driverError.code === 'string'
      ? driverError.code
      : undefined;
  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
          .replace(
            /postgres(?:ql)?:\/\/[^\s"'`]+/gi,
            '[redacted connection URL]',
          )
          .replace(/(password|pwd)(\s*[=:]\s*)\S+/gi, '$1$2[redacted]')
      : undefined;
  const details = [name, code ?? driverCode, message]
    .filter(Boolean)
    .join(', ');

  return details ? ` (${details})` : '';
}

export function getPostgresTestDataSource(): DataSource {
  if (!dataSource?.isInitialized) {
    throw new Error('The PostgreSQL test database has not been initialized.');
  }
  return dataSource;
}

export function getAppliedTestMigrations(): readonly string[] {
  return appliedMigrations;
}

export async function destroyPostgresTestDatabase(): Promise<void> {
  const current = dataSource;
  dataSource = undefined;
  appliedMigrations = [];
  if (current?.isInitialized) {
    await current.destroy();
  }
}
