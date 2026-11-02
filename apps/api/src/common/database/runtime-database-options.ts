import { TYPEORM_EXECUTION_SAFETY } from './typeorm-execution-options';

export interface RuntimeDatabaseSettings {
  nodeEnv: string;
  databaseUrl: string;
}

export function createRuntimeDatabaseOptions({
  nodeEnv,
  databaseUrl,
}: RuntimeDatabaseSettings) {
  const isProd = nodeEnv === 'production';

  return {
    type: 'postgres' as const,
    url: databaseUrl,
    autoLoadEntities: true,
    ...TYPEORM_EXECUTION_SAFETY,
    ssl: isProd ? { rejectUnauthorized: false } : false,
    extra: isProd ? { ssl: { rejectUnauthorized: false } } : {},
  };
}
