import {
  classifyMigration,
  assertRecoveryTargetIsDistinct,
  dataPrecheckColumns,
  dataPrecheckSql,
  databaseIdentity,
  findFirstUnresolvedMigration,
  hasUnresolvedDataPrechecks,
  isSameDatabaseTarget,
  migrationEffectManifest,
  normalizeHost,
  probeSql,
  sanitizeErrorMessage,
  type MigrationEffectManifest,
  type MigrationPlanEntry,
  type MigrationProbeResult,
} from './migration-recovery-planner';

describe('migration recovery planner', () => {
  const expectedMigrations = [
    { name: 'IdentitySchemaBootstrap1749000000000', timestamp: 1749000000000 },
    { name: 'AuthCompanyMembership1760000000000', timestamp: 1760000000000 },
    { name: 'CompanyAdminWorkflows1761000000000', timestamp: 1761000000000 },
    { name: 'CreateDomainSchema1791882600000', timestamp: 1791882600000 },
    {
      name: 'ContractRoleRevocationNullable1791882600001',
      timestamp: 1791882600001,
    },
    {
      name: 'NullableActivityRequestContext1791882600002',
      timestamp: 1791882600002,
    },
    { name: 'WorkspaceAdminRole1791882600003', timestamp: 1791882600003 },
    { name: 'ContractRoleInvitations1791882600004', timestamp: 1791882600004 },
    { name: 'ContractLifecycle1792862700000', timestamp: 1792862700000 },
    {
      name: 'CompanyInvitationExpiryIndex1792862700001',
      timestamp: 1792862700001,
    },
    {
      name: 'CompanyInvitationOptionalNames1793100000000',
      timestamp: 1793100000000,
    },
  ];

  describe('manifest completeness and ordering', () => {
    it('contains all registered migrations in exact timestamp order', () => {
      expect(migrationEffectManifest).toHaveLength(11);
      expect(
        migrationEffectManifest.map(({ name, timestamp }) => ({
          name,
          timestamp,
        })),
      ).toEqual(expectedMigrations);
    });

    it('keeps the manifest in strictly increasing timestamp order', () => {
      const timestamps = migrationEffectManifest.map(
        ({ timestamp }) => timestamp,
      );
      const sorted = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sorted);
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
      }
    });

    it('defines an executable SQL query for every manifest probe', () => {
      for (const manifest of migrationEffectManifest) {
        expect(manifest.probes.length).toBeGreaterThan(0);
        for (const probeId of manifest.probes) {
          expect(probeSql[probeId]).toBeDefined();
          expect(typeof probeSql[probeId]).toBe('string');
          expect(probeSql[probeId].trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('defines executable SQL and required columns for every manifest data precheck', () => {
      for (const manifest of migrationEffectManifest) {
        for (const precheckId of manifest.dataPrechecks) {
          expect(dataPrecheckSql[precheckId]).toBeDefined();
          expect(typeof dataPrecheckSql[precheckId]).toBe('string');
          expect(dataPrecheckColumns[precheckId]).toBeDefined();
          expect(dataPrecheckColumns[precheckId].length).toBeGreaterThan(0);
        }
      }
    });

    it('marks only evidence-complete migrations as complete', () => {
      expect(
        migrationEffectManifest
          .filter(
            ({ verificationCoverage }) => verificationCoverage === 'complete',
          )
          .map(({ name }) => name),
      ).toEqual([
        'NullableActivityRequestContext1791882600002',
        'CompanyInvitationExpiryIndex1792862700001',
        'CompanyInvitationOptionalNames1793100000000',
      ]);
      for (const entry of migrationEffectManifest) {
        if (entry.verificationCoverage === 'partial') {
          expect(entry.limitations.length).toBeGreaterThan(0);
        }
      }
    });

    it('uses catalog checks for exact role enum labels and valid index definitions', () => {
      expect(probeSql['domain-role-enum-labels']).toContain('enumsortorder');
      expect(probeSql['domain-role-enum-labels']).toContain(
        "'Contractor Project Lead'",
      );
      expect(probeSql['company-invitation-expiry-index-def']).toContain(
        'ix.indisvalid',
      );
      expect(probeSql['company-invitation-expiry-index-def']).toContain(
        'ix.indisready',
      );
      expect(probeSql['company-invitation-expiry-index-def']).toContain(
        "ARRAY['company_id', 'status', 'expires_at']::name[]",
      );
      expect(probeSql['role-invitation-columns-and-types']).toContain(
        'COUNT(*) = 15',
      );
      expect(probeSql['role-invitation-columns-and-types']).toContain(
        "column_name = 'updated_at'",
      );
      expect(probeSql['role-invitation-columns-and-types']).toContain(
        'PRIMARY KEY (id)',
      );
    });

    it('treats coverage metadata as a fail-closed requirement', () => {
      const entry = migrationEffectManifest.find(
        ({ name }) => name === 'CreateDomainSchema1791882600000',
      )!;
      const allPresent = entry.probes.map((id) => ({
        id,
        present: true,
        detail: 'probe passed',
      }));
      expect(classifyMigration(entry, true, allPresent)).toBe(
        'CONFLICTING_OR_UNKNOWN',
      );
    });
  });

  describe('classifyMigration', () => {
    it('fails closed as CONFLICTING_OR_UNKNOWN if any migration is marked partial coverage', () => {
      const partialManifest: MigrationEffectManifest = {
        name: 'HypotheticalPartialMigration',
        timestamp: 1800000000000,
        effects: ['Partial test'],
        verificationCoverage: 'partial',
        probes: ['test-probe'],
        dataPrechecks: [],
        limitations: ['Partial coverage'],
      };
      const allPresent: MigrationProbeResult[] = [
        { id: 'test-probe', present: true, detail: 'present' },
      ];
      const allMissing: MigrationProbeResult[] = [
        { id: 'test-probe', present: false, detail: 'missing' },
      ];

      expect(classifyMigration(partialManifest, true, allPresent)).toBe(
        'CONFLICTING_OR_UNKNOWN',
      );
      expect(classifyMigration(partialManifest, false, allPresent)).toBe(
        'CONFLICTING_OR_UNKNOWN',
      );
      expect(classifyMigration(partialManifest, false, allMissing)).toBe(
        'CONFLICTING_OR_UNKNOWN',
      );
    });

    it('classifies complete effect coverage using schema probes and history', () => {
      const manifest = migrationEffectManifest.find(
        ({ name }) => name === 'NullableActivityRequestContext1791882600002',
      )!;
      const allPresent: MigrationProbeResult[] = manifest.probes.map((id) => ({
        id,
        present: true,
        detail: 'present',
      }));
      const allMissing: MigrationProbeResult[] = manifest.probes.map((id) => ({
        id,
        present: false,
        detail: 'missing',
      }));

      expect(classifyMigration(manifest, true, allPresent)).toBe(
        'APPLIED_AND_RECORDED',
      );
      expect(classifyMigration(manifest, false, allPresent)).toBe(
        'FULLY_PRESENT_UNRECORDED',
      );
      expect(classifyMigration(manifest, false, allMissing)).toBe(
        'NOT_PRESENT',
      );
      expect(classifyMigration(manifest, true, allMissing)).toBe(
        'CONFLICTING_OR_UNKNOWN',
      );
    });

    it('detects PARTIALLY_PRESENT when some probes are present and some missing', () => {
      const manifest = migrationEffectManifest.find(
        ({ name }) => name === 'IdentitySchemaBootstrap1749000000000',
      )!;
      const mixedProbes: MigrationProbeResult[] = [
        { id: manifest.probes[0], present: true, detail: 'present' },
        { id: manifest.probes[1], present: false, detail: 'missing' },
      ];

      expect(classifyMigration(manifest, true, mixedProbes)).toBe(
        'PARTIALLY_PRESENT',
      );
      expect(classifyMigration(manifest, false, mixedProbes)).toBe(
        'PARTIALLY_PRESENT',
      );
    });
  });

  describe('findFirstUnresolvedMigration and data precheck resolution', () => {
    it('stops the proposed plan at the first unresolved status migration', () => {
      const entries: MigrationPlanEntry[] = [
        {
          name: 'verified',
          timestamp: 1749000000000,
          recorded: true,
          status: 'APPLIED_AND_RECORDED',
          probes: [],
          dataPrechecks: {},
          limitations: [],
        },
        {
          name: 'unresolved',
          timestamp: 1760000000000,
          recorded: false,
          status: 'CONFLICTING_OR_UNKNOWN',
          probes: [],
          dataPrechecks: {},
          limitations: [],
        },
        {
          name: 'later',
          timestamp: 1761000000000,
          recorded: false,
          status: 'FULLY_PRESENT_UNRECORDED',
          probes: [],
          dataPrechecks: {},
          limitations: [],
        },
      ];

      expect(findFirstUnresolvedMigration(entries)?.name).toBe('unresolved');
    });

    it('stops the proposed plan at a migration with non-zero data prechecks even if applied', () => {
      const entries: MigrationPlanEntry[] = [
        {
          name: 'clean',
          timestamp: 1749000000000,
          recorded: true,
          status: 'APPLIED_AND_RECORDED',
          probes: [],
          dataPrechecks: { 'check-a': 0 },
          limitations: [],
        },
        {
          name: 'data-issue',
          timestamp: 1760000000000,
          recorded: true,
          status: 'APPLIED_AND_RECORDED',
          probes: [],
          dataPrechecks: { 'duplicate-active-assignments': 3 },
          limitations: [],
        },
        {
          name: 'after',
          timestamp: 1761000000000,
          recorded: true,
          status: 'APPLIED_AND_RECORDED',
          probes: [],
          dataPrechecks: {},
          limitations: [],
        },
      ];

      expect(findFirstUnresolvedMigration(entries)?.name).toBe('data-issue');
    });

    it('returns undefined when all migrations are resolved with clean data prechecks', () => {
      const entries: MigrationPlanEntry[] = [
        {
          name: 'first',
          timestamp: 1749000000000,
          recorded: true,
          status: 'APPLIED_AND_RECORDED',
          probes: [],
          dataPrechecks: { 'check-a': 0 },
          limitations: [],
        },
        {
          name: 'second',
          timestamp: 1760000000000,
          recorded: false,
          status: 'FULLY_PRESENT_UNRECORDED',
          probes: [],
          dataPrechecks: { 'check-b': 0 },
          limitations: [],
        },
      ];

      expect(findFirstUnresolvedMigration(entries)).toBeUndefined();
    });

    it('correctly evaluates hasUnresolvedDataPrechecks', () => {
      expect(hasUnresolvedDataPrechecks({ dataPrechecks: {} })).toBe(false);
      expect(hasUnresolvedDataPrechecks({ dataPrechecks: { check: 0 } })).toBe(
        false,
      );
      expect(
        hasUnresolvedDataPrechecks({ dataPrechecks: { check: null } }),
      ).toBe(true);
      expect(hasUnresolvedDataPrechecks({ dataPrechecks: { check: 1 } })).toBe(
        true,
      );
      expect(
        hasUnresolvedDataPrechecks({
          dataPrechecks: { 'c-1': 0, 'c-2': 5, 'c-3': null },
        }),
      ).toBe(true);
    });
  });

  describe('database identity, target safety, and secret sanitization', () => {
    it('normalizes localhost, 127.0.0.1, and IPv6 loopback addresses', () => {
      expect(normalizeHost('localhost')).toBe('127.0.0.1');
      expect(normalizeHost('127.0.0.1')).toBe('127.0.0.1');
      expect(normalizeHost('::1')).toBe('127.0.0.1');
      expect(normalizeHost('[::1]')).toBe('127.0.0.1');
      expect(normalizeHost('POSTGRES.PROD.INTERNAL')).toBe(
        'postgres.prod.internal',
      );
    });

    it('extracts database identity without credentials and normalizes default port', () => {
      const urlWithCredentials =
        'postgresql://admin:super_secret_password@localhost:5432/contractflow_dev?sslmode=disable';
      expect(databaseIdentity(urlWithCredentials)).toBe(
        '127.0.0.1:5432/contractflow_dev',
      );
      expect(databaseIdentity(urlWithCredentials)).not.toContain(
        'super_secret_password',
      );
      expect(databaseIdentity(urlWithCredentials)).not.toContain('admin');

      const urlWithoutPort = 'postgresql://127.0.0.1/contractflow_dev/';
      expect(databaseIdentity(urlWithoutPort)).toBe(
        '127.0.0.1:5432/contractflow_dev',
      );
    });

    it('throws when connection string lacks database name or host', () => {
      expect(() => databaseIdentity('postgresql://localhost/')).toThrow(
        /database name is missing/i,
      );
      expect(() => databaseIdentity('invalid-url')).toThrow(
        /invalid database connection string/i,
      );
    });

    it('detects when recovery target matches configured DATABASE_URL', () => {
      const devUrl = 'postgresql://devuser:devpass@localhost:5432/contractflow';
      const recoveryUrlSame =
        'postgresql://planner:plannerpass@127.0.0.1:5432/contractflow';
      const recoveryUrlDifferentDb =
        'postgresql://planner:plannerpass@127.0.0.1:5432/contractflow_recovery';
      const recoveryUrlDifferentPort =
        'postgresql://planner:plannerpass@127.0.0.1:5433/contractflow';

      expect(isSameDatabaseTarget(devUrl, recoveryUrlSame)).toBe(true);
      expect(isSameDatabaseTarget(devUrl, recoveryUrlDifferentDb)).toBe(false);
      expect(isSameDatabaseTarget(devUrl, recoveryUrlDifferentPort)).toBe(
        false,
      );
    });

    it('recognizes equivalent IPv6 and other loopback URL targets', () => {
      const localhost = 'postgresql://planner:secret@localhost/cf_db';

      expect(
        isSameDatabaseTarget(
          localhost,
          'postgresql://planner:secret@127.0.0.1:5432/cf_db',
        ),
      ).toBe(true);
      expect(
        isSameDatabaseTarget(
          localhost,
          'postgresql://planner:secret@[::1]:5432/cf_db',
        ),
      ).toBe(true);
      expect(
        isSameDatabaseTarget(
          localhost,
          'postgresql://planner:secret@[::1]/cf_db/',
        ),
      ).toBe(true);
      expect(
        isSameDatabaseTarget(
          localhost,
          'postgresql://planner:secret@[::1]/other_db',
        ),
      ).toBe(false);
    });

    it('rejects identities that cannot be parsed unambiguously', () => {
      expect(() =>
        isSameDatabaseTarget(
          'postgresql://planner:secret@localhost/cf_db',
          'invalid-url',
        ),
      ).toThrow(/invalid database connection string/i);
      expect(() =>
        isSameDatabaseTarget(
          'postgresql://planner:secret@localhost/cf_db',
          'https://localhost/cf_db',
        ),
      ).toThrow(/PostgreSQL URL protocol is required/i);
      expect(() =>
        databaseIdentity(
          'postgresql://user:pass@localhost/cf_db?host=other.example',
        ),
      ).toThrow(/overrides/i);
    });

    it('requires a configured application URL and refuses equivalent recovery targets', () => {
      expect(() =>
        assertRecoveryTargetIsDistinct(
          'postgresql://localhost/cf_db',
          undefined,
        ),
      ).toThrow(/DATABASE_URL must be configured/i);
      expect(() =>
        assertRecoveryTargetIsDistinct(
          'postgresql://[::1]:5432/cf_db',
          'postgresql://127.0.0.1/cf_db',
        ),
      ).toThrow(/Refusing to plan/i);
      expect(() =>
        assertRecoveryTargetIsDistinct(
          'postgresql://localhost/cf_recovery',
          'postgresql://127.0.0.1/cf_db',
        ),
      ).not.toThrow();
    });

    it('sanitizes passwords from error messages and connection strings', () => {
      const rawError =
        'Connection failed at postgresql://postgres:MySecretPassword123@db.prod:5432/data: ECONNREFUSED';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('MySecretPassword123');
      const urlWithSecrets = sanitizeErrorMessage(
        'postgresql://admin:SecretInUrl@db.example:5432/app?password=SecretInQuery token=SecretToken',
      );
      expect(urlWithSecrets).not.toContain('SecretInUrl');
      expect(urlWithSecrets).not.toContain('SecretInQuery');
      expect(urlWithSecrets).not.toContain('SecretToken');
      expect(sanitized).toContain('[redacted PostgreSQL URL]');
    });
  });

  describe('read-only probe and precheck SQL safety', () => {
    const forbiddenKeywords = [
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
      /\bDROP\b/i,
      /\bALTER\b/i,
      /\bCREATE\b/i,
      /\bTRUNCATE\b/i,
      /\bGRANT\b/i,
      /\bREVOKE\b/i,
    ];

    it('ensures all probe SQL queries are strictly read-only SELECT statements', () => {
      for (const [, sql] of Object.entries(probeSql)) {
        const trimmed = sql.trim();
        expect(trimmed.toUpperCase().startsWith('SELECT')).toBe(true);
        const sqlWithoutLiterals = sql.replace(/'[^']*'/g, '');
        for (const pattern of forbiddenKeywords) {
          expect(sqlWithoutLiterals).not.toMatch(pattern);
        }
      }
    });

    it('ensures all data precheck SQL queries are strictly read-only SELECT statements', () => {
      for (const [, sql] of Object.entries(dataPrecheckSql)) {
        const trimmed = sql.trim();
        expect(trimmed.toUpperCase().startsWith('SELECT')).toBe(true);
        for (const pattern of forbiddenKeywords) {
          expect(sql).not.toMatch(pattern);
        }
      }
    });
  });
});
