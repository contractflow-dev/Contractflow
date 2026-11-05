import {
  captureDatabaseSnapshot,
  canonicalizeSnapshot,
  snapshotsEqual,
  type DatabaseSnapshot,
} from './helpers/schema-snapshot';

describe('schema snapshot comparison', () => {
  const baseline: DatabaseSnapshot = {
    columns: ['contract.end_date:date:not-null'],
    constraints: ['contract.ck_contract_status:CHECK (status IN (...))'],
    indexes: ['contract.idx_expiry:WHERE deleted_at IS NULL'],
    enums: ['contract_status_enum=draft,active,completed'],
    migrationHistory: ['1:1792862700000:ContractLifecycle1792862700000'],
  };

  it('canonicalizes keys and rows deterministically', () => {
    expect(
      canonicalizeSnapshot({
        indexes: ['b', 'a'],
        columns: ['z', 'c'],
      }),
    ).toEqual({
      columns: ['c', 'z'],
      indexes: ['a', 'b'],
    });
    expect(snapshotsEqual(baseline, { ...baseline })).toBe(true);
  });

  it('queries the catalog definitions and flags that the snapshot promises to compare', async () => {
    const statements: string[] = [];
    const client = {
      async query(sql: string) {
        statements.push(sql);
        return {
          rows: sql.includes('to_regclass') ? [{ present: true }] : [],
        };
      },
    };
    await captureDatabaseSnapshot(client);
    const catalogSql = statements.join('\n');

    expect(catalogSql).toContain('pg_get_expr');
    expect(catalogSql).toContain('pg_get_constraintdef');
    expect(catalogSql).toContain('pg_get_indexdef');
    expect(catalogSql).toContain('ix.indisvalid');
    expect(catalogSql).toContain('enum.enumsortorder');
    expect(catalogSql).toContain('pg_extension');
    expect(catalogSql).toContain('FROM pg_sequences');
    expect(catalogSql).toContain('SELECT id::text AS id');
    expect(catalogSql).toContain('timestamp::text AS timestamp');
  });

  it.each([
    [
      'column defaults',
      'columns',
      'contract.end_date:date:not-null:DEFAULT CURRENT_DATE',
    ],
    [
      'constraint definitions',
      'constraints',
      'contract.ck_contract_status:CHECK (status IN (draft,active))',
    ],
    [
      'index predicates',
      'indexes',
      'contract.idx_expiry:WHERE status = active',
    ],
    [
      'enum labels',
      'enums',
      'contract_status_enum=draft,active,completed,cancelled',
    ],
    [
      'migration-history rows',
      'migrationHistory',
      '2:1792862700000:ContractLifecycle1792862700000',
    ],
  ])('detects changes to %s', (_label, section, changedRow) => {
    const changed = {
      ...baseline,
      [section]: [changedRow],
    };
    expect(snapshotsEqual(baseline, changed)).toBe(false);
  });
});
