import { TYPEORM_EXECUTION_SAFETY } from './typeorm-execution-options';

export interface RuntimeDatabaseSettings {
  nodeEnv: string;
  databaseUrl: string;
  ssl?: boolean;
}

export function resolveDatabaseSsl(
  nodeEnv: string | undefined,
  ssl: boolean | undefined,
): boolean {
  return ssl ?? nodeEnv === 'production';
}

export function createRuntimeDatabaseOptions({
  nodeEnv,
  databaseUrl,
  ssl,
}: RuntimeDatabaseSettings) {
  const useSsl = resolveDatabaseSsl(nodeEnv, ssl);

  return {
    type: 'postgres' as const,
    url: databaseUrl,
    autoLoadEntities: true,
    ...TYPEORM_EXECUTION_SAFETY,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    extra: useSsl ? { ssl: { rejectUnauthorized: false } } : {},
  };
}
