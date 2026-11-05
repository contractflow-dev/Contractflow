import { config } from 'dotenv';
import { MigrationExecutor, type QueryRunner } from 'typeorm';
import dataSource from '../common/database/data-source';
import {
  classifyMigration,
  assertRecoveryTargetIsDistinct,
  dataPrecheckColumns,
  dataPrecheckSql,
  findFirstUnresolvedMigration,
  hasUnresolvedDataPrechecks,
  migrationEffectManifest,
  probeSql,
  sanitizeErrorMessage,
  type MigrationEffectManifest,
  type MigrationPlanEntry,
  type MigrationProbeResult,
} from '../common/database/migration-recovery-planner';
import { registeredMigrations } from '../common/database/registered-migrations';

config({ path: ['.env', '../../.env'] });

type QueryRow = Record<string, unknown>;

export interface PlanRecoveryOptions {
  recoveryUrl?: string;
  databaseUrl?: string;
}

export interface RecoveryReport {
  mode: string;
  target: {
    database: string;
    schema: string;
    serverAddress: string | null;
    serverPort: number | null;
    databaseUser: string;
  };
  migrationHistoryTablePresent: boolean;
  migrationRegistrationMatchesManifest: boolean;
  registeredMigrationNames: string[];
  unknownHistoryNames: string[];
  migrations: MigrationPlanEntry[];
  proposedPlan: {
    safeToExecute: boolean;
    executionImplemented: boolean;
    stopAt: string | null;
    reason: string;
    unresolvedDataPrechecks: Array<{
      migration: string;
      name: string;
      count: number | null;
    }>;
  };
  limitations: string[];
}

interface PlannerRunnerCleanup {
  readonly isTransactionActive: boolean;
  rollbackTransaction(): Promise<unknown>;
  release(): Promise<unknown>;
}

export async function cleanupPlannerResources(
  queryRunner: PlannerRunnerCleanup | undefined,
  isDataSourceInitialized: () => boolean,
  destroyDataSource: () => Promise<unknown>,
): Promise<string[]> {
  const failures: string[] = [];
  try {
    if (queryRunner?.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
  } catch (error: unknown) {
    failures.push(
      error instanceof Error ? error.message : 'Transaction rollback failed.',
    );
  }
  try {
    if (queryRunner) await queryRunner.release();
  } catch (error: unknown) {
    failures.push(
      error instanceof Error ? error.message : 'Query runner release failed.',
    );
  }
  try {
    if (isDataSourceInitialized()) await destroyDataSource();
  } catch (error: unknown) {
    failures.push(
      error instanceof Error
        ? error.message
        : 'Data source destruction failed.',
    );
  }
  return failures;
}

class RecoveryMigrationExecutor extends MigrationExecutor {
  registeredMigrationNames(): string[] {
    return this.getMigrations().map(({ name }) => name);
  }
}

const probeRequiredTables: Record<string, string[]> = {
  'contract-lifecycle-workspace-seed-data': ['contract', 'contract_workspace'],
};

async function inspectProbe(
  queryRunner: QueryRunner,
  probeId: string,
): Promise<MigrationProbeResult> {
  const requiredTables = probeRequiredTables[probeId];
  if (requiredTables) {
    const tableCheck = (await queryRunner.query(
      `
        SELECT COUNT(*) = $1 AS present
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name::text = ANY($2::text[])
      `,
      [requiredTables.length, requiredTables],
    )) as QueryRow[];
    if (tableCheck[0]?.present !== true) {
      return {
        id: probeId,
        present: false,
        detail: 'Required tables for this data probe are missing.',
      };
    }
  }

  const sql = probeSql[probeId];
  if (!sql) {
    return {
      id: probeId,
      present: false,
      detail: 'No verifier is implemented for this declared effect.',
    };
  }
  const rows = (await queryRunner.query(sql)) as QueryRow[];
  const present = rows[0]?.present === true;
  return {
    id: probeId,
    present,
    detail: present
      ? 'Expected signature detected.'
      : 'Expected signature missing or incompatible.',
  };
}

async function inspectDataPrecheck(
  queryRunner: QueryRunner,
  precheckId: string,
): Promise<number | null> {
  const sql = dataPrecheckSql[precheckId];
  if (!sql) return null;
  const requiredColumns = dataPrecheckColumns[precheckId] ?? [];
  const columnsAvailable = (await queryRunner.query(
    `
      SELECT COUNT(*) = $1 AS present
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name::text, column_name::text) IN (
          SELECT * FROM unnest($2::text[], $3::text[])
        )
    `,
    [
      requiredColumns.length,
      requiredColumns.map(([table]) => table),
      requiredColumns.map(([, column]) => column),
    ],
  )) as QueryRow[];
  if (columnsAvailable[0]?.present !== true) return null;
  const rows = (await queryRunner.query(sql)) as QueryRow[];
  return Number(rows[0]?.count ?? 0);
}

async function inspectMigration(
  queryRunner: QueryRunner,
  manifest: MigrationEffectManifest,
  recordedNames: Set<string>,
): Promise<MigrationPlanEntry> {
  const probes: MigrationProbeResult[] = [];
  for (const probeId of manifest.probes) {
    probes.push(await inspectProbe(queryRunner, probeId));
  }
  const dataPrechecks: Record<string, number | null> = {};
  for (const precheckId of manifest.dataPrechecks) {
    dataPrechecks[precheckId] = await inspectDataPrecheck(
      queryRunner,
      precheckId,
    );
  }
  const recorded = recordedNames.has(manifest.name);
  const dataInspectionUnknown = Object.values(dataPrechecks).some(
    (count) => count === null,
  );
  return {
    name: manifest.name,
    timestamp: manifest.timestamp,
    recorded,
    status: dataInspectionUnknown
      ? 'CONFLICTING_OR_UNKNOWN'
      : classifyMigration(manifest, recorded, probes),
    probes,
    dataPrechecks,
    limitations: manifest.limitations,
  };
}

export async function planMigrationRecovery(
  options: PlanRecoveryOptions = {},
): Promise<RecoveryReport> {
  const recoveryUrl =
    options.recoveryUrl ?? process.env.MIGRATION_RECOVERY_DATABASE_URL;
  if (!recoveryUrl) {
    throw new Error(
      'Set MIGRATION_RECOVERY_DATABASE_URL to the deliberate planning target.',
    );
  }

  assertRecoveryTargetIsDistinct(recoveryUrl, process.env.DATABASE_URL);
  if (options.databaseUrl) {
    assertRecoveryTargetIsDistinct(recoveryUrl, options.databaseUrl);
  }

  let queryRunner: QueryRunner | undefined;
  let report: RecoveryReport | undefined;
  let operationFailed = false;
  let operationError: unknown;
  const cleanupErrors: string[] = [];
  try {
    dataSource.setOptions({
      url: recoveryUrl,
      entities: [],
      migrations: registeredMigrations,
      synchronize: false,
      migrationsRun: false,
      logging: false,
    });
    await dataSource.initialize();

    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('REPEATABLE READ');
    await queryRunner.query('SET TRANSACTION READ ONLY');

    const identityRows = (await queryRunner.query(`
      SELECT current_database() AS database_name,
        current_schema() AS schema_name,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port,
        current_user AS database_user
    `)) as QueryRow[];
    const identity = identityRows[0];
    const historyExistsRows = (await queryRunner.query(`
      SELECT to_regclass(format('%I.%I', current_schema(), 'migrations')) IS NOT NULL AS present
    `)) as QueryRow[];
    const historyExists = historyExistsRows[0]?.present === true;
    const historyRows = historyExists
      ? ((await queryRunner.query(
          'SELECT name FROM migrations ORDER BY timestamp, id',
        )) as QueryRow[])
      : [];
    const recordedNames = new Set(historyRows.map(({ name }) => String(name)));

    const registered = new RecoveryMigrationExecutor(
      dataSource,
    ).registeredMigrationNames();
    const manifestNames = migrationEffectManifest.map(({ name }) => name);
    const registrationMatches =
      registered.length === manifestNames.length &&
      registered.every((name, index) => name === manifestNames[index]);
    const orderedEntries: MigrationPlanEntry[] = [];
    for (const entry of migrationEffectManifest) {
      orderedEntries.push(
        await inspectMigration(queryRunner, entry, recordedNames),
      );
    }
    const unresolvedDataChecks = orderedEntries.flatMap((entry) =>
      Object.entries(entry.dataPrechecks)
        .filter(([, count]) => count === null || count > 0)
        .map(([name, count]) => ({ migration: entry.name, name, count })),
    );
    const firstPlanBlocker = findFirstUnresolvedMigration(orderedEntries);
    const unknownHistoryNames = [...recordedNames].filter(
      (name) => !manifestNames.includes(name),
    );

    if (
      !identity ||
      !identity.database_name ||
      !identity.schema_name ||
      !identity.database_user ||
      identity.server_port === null ||
      identity.server_port === undefined
    ) {
      throw new Error('PostgreSQL did not return a complete target identity.');
    }

    report = {
      mode: 'read-only-plan',
      target: {
        database: String(identity.database_name),
        schema: String(identity.schema_name),
        serverAddress:
          identity.server_address === null
            ? null
            : String(identity.server_address),
        serverPort: Number(identity.server_port),
        databaseUser: String(identity.database_user),
      },
      migrationHistoryTablePresent: historyExists,
      migrationRegistrationMatchesManifest: registrationMatches,
      registeredMigrationNames: registered,
      unknownHistoryNames,
      migrations: orderedEntries,
      proposedPlan: {
        safeToExecute: false,
        executionImplemented: false,
        stopAt: firstPlanBlocker?.name ?? null,
        reason: !registrationMatches
          ? 'Registered migration classes differ from the reviewed manifest.'
          : unknownHistoryNames.length > 0
            ? 'Migration history contains names absent from the reviewed manifest.'
            : firstPlanBlocker
              ? hasUnresolvedDataPrechecks(firstPlanBlocker)
                ? `Data prechecks require review at ${firstPlanBlocker.name}.`
                : `Full migration effects are unresolved at ${firstPlanBlocker.name}.`
              : 'All migration effects are verified, but this tool intentionally does not execute recovery.',
        unresolvedDataPrechecks: unresolvedDataChecks,
      },
      limitations: [
        'This command is read-only and does not repair schema or migration history.',
        'Migrations with partial manifest coverage always fail closed as CONFLICTING_OR_UNKNOWN.',
        'Offline target identity checks cannot resolve DNS aliases or prove physical PostgreSQL server separation.',
        'A passing object probe is not proof that unlisted migration effects or data transformations completed.',
      ],
    };
  } catch (error: unknown) {
    operationFailed = true;
    operationError = error;
  } finally {
    cleanupErrors.push(
      ...(await cleanupPlannerResources(
        queryRunner,
        () => dataSource.isInitialized,
        () => dataSource.destroy(),
      )),
    );
  }
  if (operationFailed) {
    const message =
      operationError instanceof Error
        ? operationError.message
        : 'Database inspection failed.';
    throw new Error(
      sanitizeErrorMessage(
        cleanupErrors.length > 0
          ? `${message} Cleanup also failed: ${cleanupErrors.join('; ')}`
          : message,
      ),
    );
  }
  if (cleanupErrors.length > 0) {
    throw new Error(
      sanitizeErrorMessage(
        `Planner cleanup failed: ${cleanupErrors.join('; ')}`,
      ),
    );
  }
  if (!report) {
    throw new Error('Database inspection did not produce a recovery report.');
  }
  return report;
}

async function main(): Promise<void> {
  if (process.argv.length !== 3 || process.argv[2] !== '--plan') {
    throw new Error(
      'Usage: pnpm --filter @contractflow/api migration:recovery:plan -- --plan',
    );
  }

  const report = await planMigrationRecovery();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('plan-migration-recovery.ts')
) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unknown planning error.';
    const sanitized = sanitizeErrorMessage(message);
    process.stderr.write(`Migration recovery planning failed: ${sanitized}\n`);
    process.exitCode = 1;
  });
}
