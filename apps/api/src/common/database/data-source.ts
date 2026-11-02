import { config } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { registeredMigrations } from './registered-migrations';
import { TYPEORM_EXECUTION_SAFETY } from './typeorm-execution-options';

config({ path: ['.env', '../../.env'] });

const isProd = process.env.NODE_ENV === 'production';

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
    ssl: isProd ? { rejectUnauthorized: false } : false,
    extra: isProd ? { ssl: { rejectUnauthorized: false } } : {},
    ...TYPEORM_EXECUTION_SAFETY,
  });
}

export default createMigrationDataSource(process.env.DATABASE_URL);
