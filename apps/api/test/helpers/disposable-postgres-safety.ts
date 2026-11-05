export interface DisposablePostgresEnvironment {
  TEST_POSTGRES_URL?: string;
  CONTRACTFLOW_RUN_DISPOSABLE_POSTGRES_TESTS?: string;
  CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST?: string;
  DATABASE_URL?: string;
  CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER?: string;
  CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER?: string;
}

const disposablePostgresEnvironmentKeys = [
  'TEST_POSTGRES_URL',
  'CONTRACTFLOW_RUN_DISPOSABLE_POSTGRES_TESTS',
  'CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST',
  'CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER',
  'CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER',
] as const satisfies readonly (keyof DisposablePostgresEnvironment)[];

export function hasDisposablePostgresTestConfiguration(
  environment: DisposablePostgresEnvironment,
): boolean {
  return disposablePostgresEnvironmentKeys.some(
    (key) => !isBlank(environment[key]),
  );
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}

function normalizeHost(host: string): string {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(normalized)
    ? '127.0.0.1'
    : normalized;
}

function endpoint(url: URL): string {
  return `${normalizeHost(url.hostname)}:${url.port || '5432'}`;
}

function parsePostgresUrl(value: string | undefined, label: string): URL {
  if (!value) {
    throw new Error(`${label} must be explicitly configured.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid PostgreSQL URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error(`${label} must identify a PostgreSQL host.`);
  }
  if (!url.pathname || url.pathname === '/') {
    throw new Error(`${label} must identify its administrative database.`);
  }
  const ambiguousKeys = new Set([
    'host',
    'hostaddr',
    'port',
    'dbname',
    'database',
    'service',
    'servicefile',
  ]);
  if (
    [...url.searchParams.keys()].some((key) =>
      ambiguousKeys.has(key.toLowerCase()),
    )
  ) {
    throw new Error(
      `${label} contains connection parameters that make its target ambiguous.`,
    );
  }
  return url;
}

function requireSystemIdentifier(
  value: string | undefined,
  label: string,
): string {
  if (!value || !/^[0-9]+$/.test(value)) {
    throw new Error(
      `${label} must be a verified PostgreSQL system identifier.`,
    );
  }
  return value;
}

export function assertDisposablePostgresSystemIdentifier(
  actualSystemIdentifier: string,
  environment: DisposablePostgresEnvironment,
): void {
  const expectedDisposableIdentifier = requireSystemIdentifier(
    environment.CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER,
    'CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER',
  );
  const apiSystemIdentifier = requireSystemIdentifier(
    environment.CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER,
    'CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER',
  );
  const actualIdentifier = requireSystemIdentifier(
    actualSystemIdentifier,
    'Connected PostgreSQL server',
  );

  if (expectedDisposableIdentifier === apiSystemIdentifier) {
    throw new Error(
      'The disposable and API PostgreSQL system identifiers must differ.',
    );
  }
  if (actualIdentifier === apiSystemIdentifier) {
    throw new Error(
      'Refusing to run disposable tests against the API PostgreSQL server.',
    );
  }
  if (actualIdentifier !== expectedDisposableIdentifier) {
    throw new Error(
      'The connected PostgreSQL server does not match the independently verified disposable server.',
    );
  }
}

export function getDisposablePostgresUrl(
  environment: DisposablePostgresEnvironment,
): string {
  if (environment.CONTRACTFLOW_RUN_DISPOSABLE_POSTGRES_TESTS !== '1') {
    throw new Error(
      'Set CONTRACTFLOW_RUN_DISPOSABLE_POSTGRES_TESTS=1 to opt in to disposable database tests.',
    );
  }
  const configuredTestUrl = environment.TEST_POSTGRES_URL;
  if (!configuredTestUrl) {
    throw new Error('TEST_POSTGRES_URL must be explicitly configured.');
  }
  const testUrl = parsePostgresUrl(configuredTestUrl, 'TEST_POSTGRES_URL');
  const applicationUrl = parsePostgresUrl(
    environment.DATABASE_URL,
    'DATABASE_URL for server-isolation comparison',
  );
  const allowlist = (
    environment.CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST ?? ''
  )
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0 || !allowlist.includes(endpoint(testUrl))) {
    throw new Error(
      'The TEST_POSTGRES_URL endpoint must appear in CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST as host:port.',
    );
  }
  if (endpoint(testUrl) === endpoint(applicationUrl)) {
    throw new Error(
      'Disposable PostgreSQL tests must use a server endpoint distinct from DATABASE_URL.',
    );
  }
  const disposableSystemIdentifier = requireSystemIdentifier(
    environment.CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER,
    'CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER',
  );
  const apiSystemIdentifier = requireSystemIdentifier(
    environment.CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER,
    'CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER',
  );
  if (disposableSystemIdentifier === apiSystemIdentifier) {
    throw new Error(
      'The disposable and API PostgreSQL system identifiers must differ.',
    );
  }
  return configuredTestUrl;
}

export function isOwnedDisposableDatabase(
  databaseName: string,
  ownedNames: ReadonlySet<string>,
): boolean {
  return (
    databaseName.startsWith('cf_plan_test_') && ownedNames.has(databaseName)
  );
}

export function assertOwnedDisposableDatabase(
  databaseName: string,
  ownedNames: ReadonlySet<string>,
): void {
  if (!isOwnedDisposableDatabase(databaseName, ownedNames)) {
    throw new Error(
      'Refusing to drop a disposable database not created and owned by this test run.',
    );
  }
}
