import {
  cleanupPlannerResources,
  planMigrationRecovery,
  type PlanRecoveryOptions,
} from './plan-migration-recovery';

describe('migration recovery planner target enforcement', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('cannot bypass configured-target rejection with an extra runtime option', async () => {
    const configuredUrl = 'postgresql://app@localhost:5432/contractflow';
    vi.stubEnv('DATABASE_URL', configuredUrl);
    const options: PlanRecoveryOptions & { enforceTargetCheck: boolean } = {
      recoveryUrl: 'postgresql://planner@127.0.0.1/contractflow',
      databaseUrl: 'postgresql://app@other.example/other_database',
      enforceTargetCheck: false,
    };

    await expect(planMigrationRecovery(options)).rejects.toThrow(
      /Refusing to plan against the configured DATABASE_URL target/i,
    );
  });

  it('fails before inspection when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '');

    await expect(
      planMigrationRecovery({
        recoveryUrl: 'postgresql://planner@db.example/recovery',
      }),
    ).rejects.toThrow(/DATABASE_URL must be configured/i);
  });

  it('rejects ambiguous target overrides before database initialization', async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://app@application.example/contractflow',
    );

    await expect(
      planMigrationRecovery({
        recoveryUrl:
          'postgresql://planner@recovery.example/recovery?host=application.example',
      }),
    ).rejects.toThrow(/overrides/i);
  });

  it('attempts release and destruction even when rollback fails', async () => {
    const queryRunner = {
      isTransactionActive: true,
      rollbackTransaction: vi
        .fn()
        .mockRejectedValue(new Error('rollback password=hidden')),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const destroyDataSource = vi
      .fn()
      .mockRejectedValue(new Error('destroy failed'));

    const failures = await cleanupPlannerResources(
      queryRunner,
      () => true,
      destroyDataSource,
    );

    expect(queryRunner.release).toHaveBeenCalledOnce();
    expect(destroyDataSource).toHaveBeenCalledOnce();
    expect(failures).toHaveLength(2);
  });

  it('records release and destruction failures rather than reporting success', async () => {
    const queryRunner = {
      isTransactionActive: false,
      rollbackTransaction: vi.fn(),
      release: vi.fn().mockRejectedValue(new Error('release failed')),
    };
    const destroyDataSource = vi
      .fn()
      .mockRejectedValue(new Error('destroy failed'));

    const failures = await cleanupPlannerResources(
      queryRunner,
      () => true,
      destroyDataSource,
    );

    expect(failures).toEqual(['release failed', 'destroy failed']);
  });
});
