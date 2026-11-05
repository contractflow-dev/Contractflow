import { config } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { registeredMigrations } from './registered-migrations';
import { resolveDatabaseSsl } from './runtime-database-options';
import { TYPEORM_EXECUTION_SAFETY } from './typeorm-execution-options';

config({ path: ['.env', '../../.env'] });

const rawDbSsl = process.env.DB_SSL?.trim();
const useSsl = resolveDatabaseSsl(
  process.env.NODE_ENV,
  rawDbSsl ? rawDbSsl === 'true' : undefined,
);

export function createMigrationDataSource(
  databaseUrl: string | undefined,
  entities: DataSourceOptions['entities'] = [
    __dirname + '/../../modules/**/*.entity{.ts,.js}',
  ],
): DataSource {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities,
    migrations: registeredMigrations,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    extra: useSsl ? { ssl: { rejectUnauthorized: false } } : {},
    ...TYPEORM_EXECUTION_SAFETY,
  });
}

export default createMigrationDataSource(process.env.DATABASE_URL);
