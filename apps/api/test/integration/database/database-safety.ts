export interface TestDatabaseEnvironment {
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
}

interface ParsedDatabaseTarget {
  url: URL;
  databaseName: string;
}

const testDatabaseNamePattern = /^contractflow_test(?:_[a-z0-9]+)*$/i;
const ambiguousConnectionParameters = new Set([
  'host',
  'hostaddr',
  'port',
  'dbname',
  'database',
  'service',
  'servicefile',
]);

function parseDatabaseTarget(
  value: string,
  label: string,
): ParsedDatabaseTarget {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname ||
    url.pathname === '/' ||
    url.hash
  ) {
    throw new Error(`${label} must identify a PostgreSQL host and database.`);
  }
  if (
    [...url.searchParams.keys()].some((key) =>
      ambiguousConnectionParameters.has(key.toLowerCase()),
    )
  ) {
    throw new Error(`${label} contains ambiguous database target parameters.`);
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error(`${label} contains an invalid database name.`);
  }
  if (!databaseName || databaseName.includes('/')) {
    throw new Error(`${label} must identify exactly one database.`);
  }

  return { url, databaseName };
}

function endpoint(target: ParsedDatabaseTarget): string {
  const host = target.url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const normalizedHost = ['localhost', '127.0.0.1', '::1'].includes(host)
    ? '127.0.0.1'
    : host;
  return `${normalizedHost}:${target.url.port || '5432'}`;
}

function rejectProductionLikeTarget(
  target: ParsedDatabaseTarget,
  label: string,
): void {
  const productionLikeName =
    /(^|[_-])(prod|production|dev|development|stage|staging)([_-]|$)/i.test(
      target.databaseName,
    );
  const productionLikeHost = /(^|[.-])(prod|production)([.-]|$)/i.test(
    target.url.hostname,
  );
  if (productionLikeName || productionLikeHost) {
    throw new Error(`${label} must not target a production-like database.`);
  }
}

export function getTestDatabaseUrl(
  environment: TestDatabaseEnvironment = process.env,
): string {
  if (environment.NODE_ENV === 'production') {
    throw new Error(
      'PostgreSQL integration tests cannot run in production mode.',
    );
  }
  const configuredUrl = environment.TEST_DATABASE_URL?.trim();
  if (!configuredUrl) {
    throw new Error('TEST_DATABASE_URL must be explicitly configured.');
  }

  const testTarget = parseDatabaseTarget(configuredUrl, 'TEST_DATABASE_URL');
  if (!testDatabaseNamePattern.test(testTarget.databaseName)) {
    throw new Error(
      'TEST_DATABASE_URL must target a dedicated contractflow_test database.',
    );
  }
  rejectProductionLikeTarget(testTarget, 'TEST_DATABASE_URL');

  const applicationUrl = environment.DATABASE_URL?.trim();
  if (applicationUrl) {
    const applicationTarget = parseDatabaseTarget(
      applicationUrl,
      'DATABASE_URL safety comparison',
    );
    if (
      endpoint(testTarget) === endpoint(applicationTarget) &&
      testTarget.databaseName === applicationTarget.databaseName
    ) {
      throw new Error(
        'TEST_DATABASE_URL must not target the configured application database.',
      );
    }
  }

  return configuredUrl;
}

export function getTestDatabaseName(databaseUrl: string): string {
  return parseDatabaseTarget(databaseUrl, 'TEST_DATABASE_URL').databaseName;
}
