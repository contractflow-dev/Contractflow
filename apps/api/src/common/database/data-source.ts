import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ path: ['.env', '../../.env'] });

const isProd = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  ssl: isProd ? { rejectUnauthorized: false } : false,
  extra: isProd ? { ssl: { rejectUnauthorized: false } } : {},
});