import {
  assertDisposablePostgresSystemIdentifier,
  assertOwnedDisposableDatabase,
  getDisposablePostgresUrl,
  hasDisposablePostgresTestConfiguration,
  isOwnedDisposableDatabase,
} from './helpers/disposable-postgres-safety';

describe('disposable PostgreSQL test safeguards', () => {
  const configuredEnvironment = {
    TEST_POSTGRES_URL:
      'postgresql://test:test@disposable.example:5544/postgres',
    CONTRACTFLOW_RUN_DISPOSABLE_POSTGRES_TESTS: '1',
    CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST: 'disposable.example:5544',
    CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER: '123456789',
    CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER: '987654321',
    DATABASE_URL: 'postgresql://app:app@application.example:5432/contractflow',
  };

  it('requires explicit opt-in, test URL, app URL, and endpoint allowlisting', () => {
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        CONTRACTFLOW_RUN_DISPOSABLE_POSTGRES_TESTS: undefined,
      }),
    ).toThrow(/opt in/i);
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        TEST_POSTGRES_URL: undefined,
      }),
    ).toThrow(/TEST_POSTGRES_URL/i);
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST: '',
      }),
    ).toThrow(/ALLOWLIST/i);
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        DATABASE_URL: undefined,
      }),
    ).toThrow(/DATABASE_URL/i);
  });

  it('returns only the explicitly configured allowlisted PostgreSQL target', () => {
    expect(getDisposablePostgresUrl(configuredEnvironment)).toBe(
      configuredEnvironment.TEST_POSTGRES_URL,
    );
  });

  it('rejects test and application URLs on the same server, even with different database names', () => {
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        TEST_POSTGRES_URL: 'postgresql://test:test@localhost:5432/test_admin',
        DATABASE_URL: 'postgresql://app:app@127.0.0.1:5432/contractflow',
        CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST: '127.0.0.1:5432',
      }),
    ).toThrow(/server endpoint distinct/i);
  });

  it('normalizes IPv4 and IPv6 loopback for the explicit endpoint allowlist', () => {
    expect(
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        TEST_POSTGRES_URL: 'postgresql://test:test@[::1]:5432/postgres',
        DATABASE_URL:
          'postgresql://app:app@application.example:5432/contractflow',
        CONTRACTFLOW_DISPOSABLE_POSTGRES_ALLOWLIST: '127.0.0.1:5432',
      }),
    ).toBe('postgresql://test:test@[::1]:5432/postgres');
  });

  it('rejects connection parameters that can make offline endpoint identity ambiguous', () => {
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        TEST_POSTGRES_URL:
          'postgresql://test:test@disposable.example:5544/postgres?host=other.example',
      }),
    ).toThrow(/ambiguous/i);
  });

  it('requires both independently verified PostgreSQL server identifiers', () => {
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER: undefined,
      }),
    ).toThrow(/DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER/i);
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER: undefined,
      }),
    ).toThrow(/API_POSTGRES_SYSTEM_IDENTIFIER/i);
    expect(() =>
      getDisposablePostgresUrl({
        ...configuredEnvironment,
        CONTRACTFLOW_API_POSTGRES_SYSTEM_IDENTIFIER:
          configuredEnvironment.CONTRACTFLOW_DISPOSABLE_POSTGRES_SYSTEM_IDENTIFIER,
      }),
    ).toThrow(/system identifiers must differ/i);
  });

  it('validates the connected server against the independently verified identities', () => {
    expect(() =>
      assertDisposablePostgresSystemIdentifier(
        '123456789',
        configuredEnvironment,
      ),
    ).not.toThrow();
    expect(() =>
      assertDisposablePostgresSystemIdentifier(
        '987654321',
        configuredEnvironment,
      ),
    ).toThrow(/API PostgreSQL server/i);
    expect(() =>
      assertDisposablePostgresSystemIdentifier(
        '111111111',
        configuredEnvironment,
      ),
    ).toThrow(/does not match/i);
  });

  it('detects whether any disposable test configuration was supplied', () => {
    expect(hasDisposablePostgresTestConfiguration({})).toBe(false);
    expect(
      hasDisposablePostgresTestConfiguration({
        DATABASE_URL: 'configured',
      }),
    ).toBe(false);
    expect(
      hasDisposablePostgresTestConfiguration({
        TEST_POSTGRES_URL: 'configured',
      }),
    ).toBe(true);
  });

  it('only permits cleanup for a generated database tracked as owned by this run', () => {
    const owned = new Set(['cf_plan_test_run_123']);
    expect(isOwnedDisposableDatabase('cf_plan_test_run_123', owned)).toBe(true);
    expect(() =>
      assertOwnedDisposableDatabase('cf_plan_test_other_123', owned),
    ).toThrow(/not created and owned/i);
    expect(() => assertOwnedDisposableDatabase('postgres', owned)).toThrow(
      /not created and owned/i,
    );
  });
});
