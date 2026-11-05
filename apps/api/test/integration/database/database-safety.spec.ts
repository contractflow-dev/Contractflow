import { getTestDatabaseName, getTestDatabaseUrl } from './database-safety';

describe('PostgreSQL integration database safety', () => {
  const validEnvironment = {
    TEST_DATABASE_URL:
      'postgresql://test_user:test_password@localhost:5432/contractflow_test',
    DATABASE_URL:
      'postgresql://app_user:app_password@localhost:5432/contractflow_dev',
    NODE_ENV: 'test',
  };

  it('requires an explicitly configured test database URL', () => {
    expect(() =>
      getTestDatabaseUrl({ ...validEnvironment, TEST_DATABASE_URL: '' }),
    ).toThrow('TEST_DATABASE_URL must be explicitly configured.');
    expect(() =>
      getTestDatabaseUrl({ ...validEnvironment, TEST_DATABASE_URL: undefined }),
    ).toThrow('TEST_DATABASE_URL must be explicitly configured.');
  });

  it('rejects invalid URLs, non-PostgreSQL URLs, and ambiguous targets', () => {
    for (const TEST_DATABASE_URL of [
      'not-a-url',
      'sqlite://localhost/contractflow_test',
      'postgresql://localhost/',
      'postgresql://localhost/contractflow_test?host=other.example',
    ]) {
      expect(() =>
        getTestDatabaseUrl({ ...validEnvironment, TEST_DATABASE_URL }),
      ).toThrow();
    }
  });

  it('accepts a dedicated test database without exposing credentials', () => {
    expect(getTestDatabaseUrl(validEnvironment)).toBe(
      validEnvironment.TEST_DATABASE_URL,
    );
    expect(getTestDatabaseName(validEnvironment.TEST_DATABASE_URL)).toBe(
      'contractflow_test',
    );
  });

  it('rejects application, production-like, and non-dedicated databases', () => {
    for (const name of [
      'contractflow',
      'contractflow_dev',
      'contractflow_production',
      'production',
      'cf_test',
    ]) {
      expect(() =>
        getTestDatabaseUrl({
          ...validEnvironment,
          TEST_DATABASE_URL: `postgresql://localhost:5432/${name}`,
        }),
      ).toThrow();
    }
  });

  it('rejects the exact application database target and production mode', () => {
    expect(() =>
      getTestDatabaseUrl({
        ...validEnvironment,
        DATABASE_URL: validEnvironment.TEST_DATABASE_URL,
      }),
    ).toThrow(/application database/i);
    expect(() =>
      getTestDatabaseUrl({
        ...validEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow(/production mode/i);
  });

  it('does not include URL credentials in safety errors', () => {
    let message = '';
    try {
      getTestDatabaseUrl({
        ...validEnvironment,
        TEST_DATABASE_URL:
          'postgresql://secret_user:secret_password@localhost:5432/production',
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain('secret_user');
    expect(message).not.toContain('secret_password');
  });
});
