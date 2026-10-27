export interface SnapshotQueryResult {
  rows: Record<string, unknown>[];
}

export interface SnapshotClient {
  query(sql: string): Promise<SnapshotQueryResult>;
}

export type DatabaseSnapshot = Record<string, string[]>;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function serializeRows(rows: Record<string, unknown>[]): string[] {
  return rows.map((row) => JSON.stringify(row) ?? '{}').sort(compareStrings);
}

export function canonicalizeSnapshot(
  snapshot: DatabaseSnapshot,
): DatabaseSnapshot {
  return Object.fromEntries(
    Object.keys(snapshot)
      .sort(compareStrings)
      .map((key) => [key, [...snapshot[key]].sort(compareStrings)]),
  );
}

export function snapshotsEqual(
  left: DatabaseSnapshot,
  right: DatabaseSnapshot,
): boolean {
  return (
    JSON.stringify(canonicalizeSnapshot(left)) ===
    JSON.stringify(canonicalizeSnapshot(right))
  );
}

export async function captureDatabaseSnapshot(
  client: SnapshotClient,
): Promise<DatabaseSnapshot> {
  const queries: Record<string, string> = {
    schemas: `
      SELECT namespace_row.nspname AS schema_name,
        pg_get_userbyid(namespace_row.nspowner) AS owner
      FROM pg_namespace namespace_row
      WHERE namespace_row.nspname !~ '^(pg_|information_schema)'
      ORDER BY namespace_row.nspname
    `,
    relations: `
      SELECT namespace_row.nspname AS schema_name,
        relation.relname AS relation_name,
        relation.relkind AS kind,
        relation.relpersistence AS persistence,
        pg_get_userbyid(relation.relowner) AS owner
      FROM pg_class relation
      JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
      WHERE namespace_row.nspname !~ '^(pg_|information_schema)'
        AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      ORDER BY namespace_row.nspname, relation.relname
    `,
    columns: `
      SELECT namespace_row.nspname AS schema_name,
        relation.relname AS table_name,
        attribute_row.attnum AS ordinal,
        attribute_row.attname AS column_name,
        format_type(attribute_row.atttypid, attribute_row.atttypmod) AS data_type,
        attribute_row.attnotnull AS not_null,
        pg_get_expr(default_value.adbin, default_value.adrelid) AS default_expression,
        attribute_row.attidentity AS identity_kind,
        attribute_row.attgenerated AS generated_kind,
        collation_row.collname AS collation
      FROM pg_attribute attribute_row
      JOIN pg_class relation ON relation.oid = attribute_row.attrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
      LEFT JOIN pg_attrdef default_value
        ON default_value.adrelid = relation.oid
       AND default_value.adnum = attribute_row.attnum
      LEFT JOIN pg_collation collation_row
        ON collation_row.oid = attribute_row.attcollation
      WHERE namespace_row.nspname !~ '^(pg_|information_schema)'
        AND attribute_row.attnum > 0
        AND NOT attribute_row.attisdropped
        AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      ORDER BY namespace_row.nspname, relation.relname, attribute_row.attnum
    `,
    constraints: `
      SELECT namespace_row.nspname AS schema_name,
        relation.relname AS table_name,
        constraint_row.conname AS constraint_name,
        constraint_row.contype AS kind,
        pg_get_constraintdef(constraint_row.oid, true) AS definition,
        constraint_row.condeferrable AS deferrable,
        constraint_row.condeferred AS initially_deferred,
        constraint_row.convalidated AS validated,
        constraint_row.connoinherit AS no_inherit
      FROM pg_constraint constraint_row
      JOIN pg_class relation ON relation.oid = constraint_row.conrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = relation.relnamespace
      WHERE namespace_row.nspname !~ '^(pg_|information_schema)'
      ORDER BY namespace_row.nspname, relation.relname, constraint_row.conname
    `,
    indexes: `
      SELECT namespace_row.nspname AS schema_name,
        table_row.relname AS table_name,
        index_table.relname AS index_name,
        access_method.amname AS access_method,
        pg_get_indexdef(index_table.oid, 0, true) AS definition,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        ix.indisexclusion AS is_exclusion,
        ix.indimmediate AS is_immediate,
        ix.indisvalid AS is_valid,
        ix.indisready AS is_ready,
        ix.indislive AS is_live,
        ix.indcheckxmin AS check_xmin,
        ix.indisclustered AS is_clustered,
        ix.indisreplident AS is_replica_identity,
        ix.indnullsnotdistinct AS nulls_not_distinct
      FROM pg_index ix
      JOIN pg_class table_row ON table_row.oid = ix.indrelid
      JOIN pg_class index_table ON index_table.oid = ix.indexrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
      JOIN pg_am access_method ON access_method.oid = index_table.relam
      WHERE namespace_row.nspname !~ '^(pg_|information_schema)'
      ORDER BY namespace_row.nspname, table_row.relname, index_table.relname
    `,
    enums: `
      SELECT namespace_row.nspname AS schema_name,
        type_row.typname AS type_name,
        enum.enumlabel AS label,
        enum.enumsortorder AS sort_order
      FROM pg_enum enum
      JOIN pg_type type_row ON type_row.oid = enum.enumtypid
      JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
      WHERE namespace_row.nspname !~ '^(pg_|information_schema)'
      ORDER BY namespace_row.nspname, type_row.typname, enum.enumsortorder
    `,
    extensions: `
      SELECT extension.extname AS extension_name,
        extension.extversion AS version,
        namespace_row.nspname AS schema_name,
        pg_get_userbyid(extension.extowner) AS owner,
        extension.extrelocatable AS relocatable
      FROM pg_extension extension
      JOIN pg_namespace namespace_row ON namespace_row.oid = extension.extnamespace
      ORDER BY extension.extname
    `,
    sequences: `
      SELECT schemaname AS schema_name,
        sequencename AS sequence_name,
        data_type,
        start_value,
        min_value,
        max_value,
        increment_by,
        cycle,
        cache_size
      FROM pg_sequences
      WHERE schemaname !~ '^(pg_|information_schema)'
      ORDER BY schemaname, sequencename
    `,
    migrationHistory: `
      SELECT id::text AS id, timestamp::text AS timestamp, name
      FROM migrations
      ORDER BY timestamp, id
    `,
  };

  const snapshot: DatabaseSnapshot = {};
  for (const [key, sql] of Object.entries(queries)) {
    if (key === 'migrationHistory') {
      const exists = await client.query(`
        SELECT to_regclass(format('%I.%I', current_schema(), 'migrations')) IS NOT NULL AS present
      `);
      if (exists.rows[0]?.present !== true) {
        snapshot[key] = [];
        continue;
      }
    }
    snapshot[key] = serializeRows((await client.query(sql)).rows);
  }
  return canonicalizeSnapshot(snapshot);
}
