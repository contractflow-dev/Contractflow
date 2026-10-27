import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { registeredMigrations } from './registered-migrations';
import { TYPEORM_EXECUTION_SAFETY } from './typeorm-execution-options';

config({ path: ['.env', '../../.env'] });

const isProd = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../../modules/**/*.entity{.ts,.js}'],
  migrations: registeredMigrations,
  ssl: isProd ? { rejectUnauthorized: false } : false,
  extra: isProd ? { ssl: { rejectUnauthorized: false } } : {},
  ...TYPEORM_EXECUTION_SAFETY,
});
