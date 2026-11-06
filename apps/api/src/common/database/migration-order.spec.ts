import { DataSource, MigrationExecutor } from 'typeorm';
import { readFileSync } from 'node:fs';
import migrationDataSource from './data-source';
import { registeredMigrations } from './registered-migrations';
import { TYPEORM_EXECUTION_SAFETY } from './typeorm-execution-options';
import { createRuntimeDatabaseOptions } from './runtime-database-options';

class TestableMigrationExecutor extends MigrationExecutor {
  orderedMigrationNames(): string[] {
    return this.getMigrations().map(({ name }) => name);
  }
}

describe('database migration configuration', () => {
  it('orders identity and domain bootstraps before dependent migrations', () => {
    const dataSource = new DataSource({ type: 'postgres' });
    dataSource.migrations.push(...registeredMigrations);

    expect(
      new TestableMigrationExecutor(dataSource).orderedMigrationNames(),
    ).toEqual([
      'IdentitySchemaBootstrap1749000000000',
      'AuthCompanyMembership1760000000000',
      'CompanyAdminWorkflows1761000000000',
      'CreateDomainSchema1791882600000',
      'ContractRoleRevocationNullable1791882600001',
      'NullableActivityRequestContext1791882600002',
      'WorkspaceAdminRole1791882600003',
      'ContractRoleInvitations1791882600004',
      'ContractLifecycle1792862700000',
      'CompanyInvitationExpiryIndex1792862700001',
      'CompanyInvitationOptionalNames1793100000000',
      'CompanyEmailVerification1793200000000',
      'DocumentObjectStorage1793300000000',
    ]);
  });

  it('keeps the CLI data source independent from schema synchronization', () => {
    expect(migrationDataSource.options.synchronize).toBe(false);
    expect(migrationDataSource.options.migrationsRun).toBe(false);
    expect(TYPEORM_EXECUTION_SAFETY).toEqual({
      synchronize: false,
      migrationsRun: false,
    });
  });

  it('uses the runtime database-options helper in the Nest configuration', () => {
    const runtimeConfiguration = readFileSync(
      new URL('../../app.module.ts', import.meta.url),
      'utf8',
    );
    expect(runtimeConfiguration).toContain('createRuntimeDatabaseOptions');
    expect(runtimeConfiguration).not.toContain('DB_SYNC');
  });

  it('disables schema synchronization in production even when DB_SYNC is true', () => {
    const options = createRuntimeDatabaseOptions({
      nodeEnv: 'production',
      databaseUrl: 'postgres://localhost/contractflow',
    });

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  it.each([
    ['production', undefined, true],
    ['development', undefined, false],
    ['production', false, false],
    ['development', true, true],
  ] as const)(
    'resolves SSL for NODE_ENV=%s with DB_SSL=%s to %s',
    (nodeEnv, ssl, expected) => {
      const options = createRuntimeDatabaseOptions({
        nodeEnv,
        databaseUrl: 'postgres://localhost/contractflow',
        ssl,
      });

      expect(options.ssl).toEqual(
        expected ? { rejectUnauthorized: false } : false,
      );
    },
  );

  it.each(['development', 'test'])(
    'keeps schema synchronization disabled in %s',
    (nodeEnv) => {
      const options = createRuntimeDatabaseOptions({
        nodeEnv,
        databaseUrl: 'postgres://localhost/contractflow',
      });

      expect(options.synchronize).toBe(false);
      expect(options.migrationsRun).toBe(false);
    },
  );
});
