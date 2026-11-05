export type MigrationRecoveryStatus =
  | 'APPLIED_AND_RECORDED'
  | 'FULLY_PRESENT_UNRECORDED'
  | 'PARTIALLY_PRESENT'
  | 'NOT_PRESENT'
  | 'CONFLICTING_OR_UNKNOWN';

export interface MigrationEffectManifest {
  name: string;
  timestamp: number;
  effects: string[];
  verificationCoverage: 'complete' | 'partial';
  probes: string[];
  dataPrechecks: string[];
  limitations: string[];
}

export interface MigrationProbeResult {
  id: string;
  present: boolean;
  detail: string;
}

export interface MigrationPlanEntry {
  name: string;
  timestamp: number;
  recorded: boolean;
  status: MigrationRecoveryStatus;
  probes: MigrationProbeResult[];
  dataPrechecks: Record<string, number | null>;
  limitations: string[];
}

export const migrationEffectManifest: MigrationEffectManifest[] = [
  {
    name: 'IdentitySchemaBootstrap1749000000000',
    timestamp: 1749000000000,
    effects: [
      'Create the app_user, company, company_user, company_invitation, and user_session tables with ULID primary keys.',
      'Create identity enums with exact ordered labels, unique keys, indexes, and company/user/session foreign keys.',
      'Create the citext extension.',
    ],
    verificationCoverage: 'partial',
    probes: [
      'identity-citext-extension',
      'identity-tables-and-pks',
      'identity-enums-and-labels',
      'identity-columns',
      'identity-foreign-keys',
      'identity-unique-keys',
    ],
    dataPrechecks: [],
    limitations: [
      'Column types, lengths, nullability, defaults, exact primary-key definitions, all index definitions, and citext ownership/version are not exhaustively verified.',
    ],
  },
  {
    name: 'AuthCompanyMembership1760000000000',
    timestamp: 1760000000000,
    effects: [
      'Make selected authentication and company-membership fields nullable and set the user-agent default.',
      'Create email_verification_token table, primary key, unique token hash, and user/created index.',
      'Create the company_user(company_id, user_id) unique membership index.',
    ],
    verificationCoverage: 'partial',
    probes: [
      'auth-nullability-and-defaults',
      'email-verification-table-and-pk',
      'email-verification-index-def',
      'company-user-unique-membership',
    ],
    dataPrechecks: [],
    limitations: [
      'The email-verification primary key and exact column/default definitions are incomplete; the user-agent default expression and all foreign keys are not fully verified.',
    ],
  },
  {
    name: 'CompanyAdminWorkflows1761000000000',
    timestamp: 1761000000000,
    effects: [
      'Make company_invitation.accepted_at nullable and convert status from enum to varchar(20).',
      'Expire pending invitations by time and resolve duplicate pending company/email invitations.',
      'Replace company-user uniqueness with active-membership uniqueness (status = active and left_at is null).',
      'Create the pending-invitation index, company_audit_log, its foreign keys, and its company/time index.',
    ],
    verificationCoverage: 'partial',
    probes: [
      'company-invitation-shape',
      'company-user-active-index-def',
      'company-invitation-pending-index-def',
      'company-audit-log-table-and-constraints',
    ],
    dataPrechecks: [
      'duplicate-active-memberships',
      'duplicate-pending-invitations',
      'expired-pending-invitations',
    ],
    limitations: [
      'The audit-log primary key and full column/default definitions are not verified. One-time invitation updates are not proven from schema alone, and absence of the superseded membership index is not checked.',
    ],
  },
  {
    name: 'CreateDomainSchema1791882600000',
    timestamp: 1791882600000,
    effects: [
      'Create all 34 contract domain tables with primary keys, 45 enum types, core table columns, and domain foreign keys.',
    ],
    verificationCoverage: 'partial',
    probes: [
      'domain-all-34-tables-and-pks',
      'domain-all-45-enum-types',
      'domain-role-enum-labels',
      'domain-core-table-columns',
      'domain-core-foreign-keys',
    ],
    dataPrechecks: [],
    limitations: [
      'Most domain column definitions, enum labels/order, indexes, unique/check constraints, and foreign keys are not exhaustively verified.',
    ],
  },
  {
    name: 'ContractRoleRevocationNullable1791882600001',
    timestamp: 1791882600001,
    effects: [
      'Make contract_role_assignment.revoked_at and revoked_by_id nullable.',
      'Create unique active-assignment index on contract_party_id, company_user_id, and contract_role where revoked_at is null.',
    ],
    verificationCoverage: 'partial',
    probes: ['revocation-columns-nullable', 'active-assignment-index'],
    dataPrechecks: ['duplicate-active-assignments'],
    limitations: [
      'The partial index predicate and catalog validity/readiness flags are not verified exactly.',
    ],
  },
  {
    name: 'NullableActivityRequestContext1791882600002',
    timestamp: 1791882600002,
    effects: [
      'Make activity_log.ip_address, user_agent, and request_id nullable.',
    ],
    verificationCoverage: 'complete',
    probes: ['activity-context-nullable'],
    dataPrechecks: [],
    limitations: [],
  },
  {
    name: 'WorkspaceAdminRole1791882600003',
    timestamp: 1791882600003,
    effects: [
      'Create unique company-scoped keys on contract_party and company_user.',
      'Add composite company-scope foreign keys to contract_role_assignment.',
      'Add the is_workspace_admin boolean with default false.',
    ],
    verificationCoverage: 'partial',
    probes: [
      'workspace-admin-column',
      'company-scope-unique-keys',
      'assignment-company-scope-foreign-keys',
    ],
    dataPrechecks: ['cross-company-role-assignments'],
    limitations: [
      'Catalog validation state and complete index definitions are not verified.',
    ],
  },
  {
    name: 'ContractRoleInvitations1791882600004',
    timestamp: 1791882600004,
    effects: [
      'Create contract_role_invitation with role/workspace/status fields, checks, and company-scoped foreign keys.',
      'Create token uniqueness, pending-invitation uniqueness, and party/status/expiry indexes.',
    ],
    verificationCoverage: 'partial',
    probes: [
      'role-invitation-columns-and-types',
      'role-invitation-check-constraints',
      'role-invitation-foreign-keys',
      'role-invitation-token-index-def',
      'role-invitation-pending-index-def',
      'role-invitation-expiry-index-def',
    ],
    dataPrechecks: [],
    limitations: [
      'Although the probe now checks all 15 expected column names and the primary key, complete nullability/default details and exact check/index definitions remain unverified.',
    ],
  },
  {
    name: 'ContractLifecycle1792862700000',
    timestamp: 1792862700000,
    effects: [
      'Add contract creator/archive metadata and relax specified contract, party, and status-history columns.',
      'Create and seed contract_workspace for project, hse, and finance workspaces.',
      'Create contract_party_invitation and its checks, foreign keys, and indexes.',
      'Create the contract status-history contract/changed index.',
    ],
    verificationCoverage: 'partial',
    probes: [
      'contract-lifecycle-columns-and-nullability',
      'contract-lifecycle-foreign-keys',
      'contract-workspace-table-and-constraints',
      'contract-lifecycle-workspace-seed-data',
      'contract-party-invitation-table-and-constraints',
      'status-history-index-def',
    ],
    dataPrechecks: [],
    limitations: [
      'Complete column definitions for lifecycle and invitation objects, exact index/constraint definitions, and catalog validation state are not exhaustively verified.',
    ],
  },
  {
    name: 'CompanyInvitationExpiryIndex1792862700001',
    timestamp: 1792862700001,
    effects: [
      'Create the company invitation company/status/expiry lookup index.',
    ],
    verificationCoverage: 'complete',
    probes: ['company-invitation-expiry-index-def'],
    dataPrechecks: [],
    limitations: [],
  },
  {
    name: 'CompanyInvitationOptionalNames1793100000000',
    timestamp: 1793100000000,
    effects: [
      'Make company_invitation.first_name and last_name nullable without changing existing invitation data.',
    ],
    verificationCoverage: 'complete',
    probes: ['company-invitation-names-nullable'],
    dataPrechecks: [],
    limitations: [],
  },
];

export function assertRecoveryTargetIsDistinct(
  recoveryUrl: string,
  configuredDatabaseUrl: string | undefined,
): void {
  if (!configuredDatabaseUrl) {
    throw new Error(
      'DATABASE_URL must be configured to validate the recovery target.',
    );
  }
  if (isSameDatabaseTarget(recoveryUrl, configuredDatabaseUrl)) {
    throw new Error(
      'Refusing to plan against the configured DATABASE_URL target.',
    );
  }
}

export function classifyMigration(
  manifest: MigrationEffectManifest,
  recorded: boolean,
  probes: MigrationProbeResult[],
): MigrationRecoveryStatus {
  const presentCount = probes.filter(({ present }) => present).length;
  const missingCount = probes.length - presentCount;

  if (presentCount > 0 && missingCount > 0) {
    return 'PARTIALLY_PRESENT';
  }
  if (manifest.verificationCoverage !== 'complete') {
    return 'CONFLICTING_OR_UNKNOWN';
  }
  if (presentCount === 0) {
    return recorded ? 'CONFLICTING_OR_UNKNOWN' : 'NOT_PRESENT';
  }
  return recorded ? 'APPLIED_AND_RECORDED' : 'FULLY_PRESENT_UNRECORDED';
}

export function hasUnresolvedDataPrechecks(
  entry: Pick<MigrationPlanEntry, 'dataPrechecks'>,
): boolean {
  if (!entry.dataPrechecks) return false;
  return Object.values(entry.dataPrechecks).some(
    (count) => count === null || count > 0,
  );
}

export function findFirstUnresolvedMigration(
  entries: MigrationPlanEntry[],
): MigrationPlanEntry | undefined {
  return entries.find(
    (entry) =>
      (entry.status !== 'APPLIED_AND_RECORDED' &&
        entry.status !== 'FULLY_PRESENT_UNRECORDED') ||
      hasUnresolvedDataPrechecks(entry),
  );
}

export const probeSql: Record<string, string> = {
  // Migration 1: IdentitySchemaBootstrap1749000000000
  'identity-citext-extension': `
    SELECT EXISTS (
      SELECT 1
      FROM pg_extension extension_row
      JOIN pg_namespace namespace_row
        ON namespace_row.oid = extension_row.extnamespace
      WHERE extension_row.extname = 'citext'
        AND namespace_row.nspname = current_schema()
    ) AS present
  `,
  'domain-role-enum-labels': `
    SELECT (
      SELECT array_agg(enum.enumlabel::text ORDER BY enum.enumsortorder)
      FROM pg_enum enum
      JOIN pg_type type_row ON type_row.oid = enum.enumtypid
      JOIN pg_namespace namespace_row ON namespace_row.oid = type_row.typnamespace
      WHERE namespace_row.nspname = current_schema()
        AND type_row.typname = 'contract_role_assignment_contract_role_enum'
    ) = ARRAY[
      'Contractor Project Lead',
      'Contractor Site Supervisor',
      'Client Project Manager',
      'Client Site Engineer',
      'HSE Officer',
      'HSE Manager',
      'Finance Officer',
      'Finance Director'
    ]::text[] AS present
  `,
  'identity-tables-and-pks': `
    SELECT (
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('app_user', 'company', 'company_user', 'company_invitation', 'user_session')) = 5
      AND
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('app_user', 'company', 'company_user', 'company_invitation', 'user_session') AND column_name = 'id' AND data_type = 'character varying' AND character_maximum_length = 26) = 5
      AND
      (SELECT COUNT(DISTINCT tc.table_name) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema WHERE tc.table_schema = current_schema() AND tc.constraint_type = 'PRIMARY KEY' AND tc.table_name IN ('app_user', 'company', 'company_user', 'company_invitation', 'user_session') AND kcu.column_name = 'id') = 5
    ) AS present
  `,
  'identity-enums-and-labels': `
    SELECT (
      (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'app_user_status_enum') = ARRAY['active', 'inactive']::text[]
      AND
      (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'company_status_enum') = ARRAY['active', 'inactive']::text[]
      AND
      (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'company_user_company_role_enum') = ARRAY['Contractor Project Lead', 'Contractor Site Supervisor', 'Client Project Manager', 'Client Site Engineer', 'HSE Officer', 'HSE Manager', 'Finance Officer', 'Finance Director', 'Company Administrator']::text[]
      AND
      (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'company_user_status_enum') = ARRAY['active', 'inactive']::text[]
      AND
      (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'company_invitation_company_role_enum') = ARRAY['Contractor Project Lead', 'Contractor Site Supervisor', 'Client Project Manager', 'Client Site Engineer', 'HSE Officer', 'HSE Manager', 'Finance Officer', 'Finance Director']::text[]
      AND
      (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = current_schema() AND t.typname = 'company_invitation_status_enum') = ARRAY['pending', 'accepted', 'declined', 'expired', 'revoked']::text[]
    ) AS present
  `,
  'identity-columns': `
    SELECT COUNT(*) = 67 AS present
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND (
        (table_name = 'company' AND column_name IN ('id', 'created_at', 'updated_at', 'name', 'legal_name', 'registration_number', 'tax_identification_number', 'email', 'phone_number', 'website', 'address_line1', 'address_line2', 'city', 'state_region', 'postal_code', 'country_code', 'default_currency_code', 'status', 'verified_at'))
        OR (table_name = 'app_user' AND column_name IN ('id', 'created_at', 'updated_at', 'email', 'first_name', 'last_name', 'middle_name', 'phone_number', 'password_hash', 'status', 'is_platform_admin', 'mfa_enabled', 'timezone', 'email_verified_at', 'last_login_at'))
        OR (table_name = 'company_user' AND column_name IN ('id', 'created_at', 'updated_at', 'company_id', 'user_id', 'company_role', 'job_title', 'status', 'joined_at', 'left_at'))
        OR (table_name = 'company_invitation' AND column_name IN ('id', 'created_at', 'updated_at', 'company_id', 'invited_by_company_user_id', 'email', 'first_name', 'last_name', 'company_role', 'token_hash', 'status', 'expires_at', 'accepted_at', 'revoked_at'))
        OR (table_name = 'user_session' AND column_name IN ('id', 'created_at', 'updated_at', 'user_id', 'refresh_token_hash', 'ip_address', 'user_agent', 'expires_at', 'revoked_at'))
      )
  `,
  'identity-foreign-keys': `
    SELECT COUNT(*) = 5 AS present
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    WHERE n.nspname = current_schema()
      AND c.contype = 'f'
      AND (
        (child.relname = 'company_user' AND parent.relname = 'company' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (company_id) REFERENCES company(id)%')
        OR (child.relname = 'company_user' AND parent.relname = 'app_user' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (user_id) REFERENCES app_user(id)%')
        OR (child.relname = 'company_invitation' AND parent.relname = 'company' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (company_id) REFERENCES company(id)%')
        OR (child.relname = 'company_invitation' AND parent.relname = 'company_user' AND c.confdeltype = 'a' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (invited_by_company_user_id) REFERENCES company_user(id)%')
        OR (child.relname = 'user_session' AND parent.relname = 'app_user' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (user_id) REFERENCES app_user(id)%')
      )
  `,
  'identity-unique-keys': `
    SELECT (
      EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'app_user' AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%(email)%'
      )
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'company_invitation' AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%(token_hash)%'
      )
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'user_session' AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%(refresh_token_hash)%'
      )
    ) AS present
  `,

  // Migration 2: AuthCompanyMembership1760000000000
  'auth-nullability-and-defaults': `
    SELECT (
      (SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'app_user' AND column_name = 'email_verified_at') = 'YES'
      AND (SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'app_user' AND column_name = 'last_login_at') = 'YES'
      AND (SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'user_session' AND column_name = 'ip_address') = 'YES'
      AND (SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'user_session' AND column_name = 'revoked_at') = 'YES'
      AND (SELECT column_default IN (quote_literal(''), quote_literal('') || '::text') FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'user_session' AND column_name = 'user_agent') = true
      AND (SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'company_user' AND column_name = 'left_at') = 'YES'
    ) AS present
  `,
  'email-verification-table-and-pk': `
    SELECT (
      to_regclass(format('%I.%I', current_schema(), 'email_verification_token')) IS NOT NULL
      AND (SELECT COUNT(*) = 7 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'email_verification_token' AND (
        (column_name = 'id' AND data_type = 'character varying' AND character_maximum_length = 26 AND is_nullable = 'NO')
        OR (column_name = 'user_id' AND data_type = 'character varying' AND character_maximum_length = 26 AND is_nullable = 'NO')
        OR (column_name = 'token_hash' AND data_type = 'character' AND character_maximum_length = 64 AND is_nullable = 'NO')
        OR (column_name = 'expires_at' AND is_nullable = 'NO')
        OR (column_name = 'used_at' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND is_nullable = 'NO')
      ))
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'email_verification_token' AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%(token_hash)%'
      )
    ) AS present
  `,
  'email-verification-index-def': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'email_verification_token'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (user_id, created_at)%'
    ) AS present
  `,
  'company-user-unique-membership': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'company_user'
        AND ix.indisunique
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (company_id, user_id)%'
    ) AS present
  `,

  // Migration 3: CompanyAdminWorkflows1761000000000
  'company-invitation-shape': `
    SELECT (
      (SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'company_invitation' AND column_name = 'accepted_at') = 'YES'
      AND
      (SELECT data_type = 'character varying' AND character_maximum_length = 20 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'company_invitation' AND column_name = 'status') = true
    ) AS present
  `,
  'company-user-active-index-def': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'company_user'
        AND ix.indisunique
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (company_id, user_id)%'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%status%active%'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%left_at IS NULL%'
    ) AS present
  `,
  'company-invitation-pending-index-def': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'company_invitation'
        AND ix.indisunique
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (company_id, email)%'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%status%pending%'
    ) AS present
  `,
  'company-invitation-expiry-index-def': `
    SELECT EXISTS (
      SELECT 1
      FROM pg_index ix
      JOIN pg_class index_table ON index_table.oid = ix.indexrelid
      JOIN pg_class table_row ON table_row.oid = ix.indrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
      JOIN pg_am access_method ON access_method.oid = index_table.relam
      WHERE namespace_row.nspname = current_schema()
        AND table_row.relname = 'company_invitation'
        AND index_table.relname = 'ix_company_invitation_company_status_expiry'
        AND access_method.amname = 'btree'
        AND NOT ix.indisunique
        AND ix.indisvalid
        AND ix.indisready
        AND ix.indislive
        AND ix.indpred IS NULL
        AND ix.indexprs IS NULL
        AND ix.indnkeyatts = 3
        AND ix.indnatts = 3
        AND (
          SELECT array_agg(attribute_row.attname ORDER BY key_row.ordinality)
          FROM unnest(ix.indkey) WITH ORDINALITY AS key_row(attnum, ordinality)
          JOIN pg_attribute attribute_row
            ON attribute_row.attrelid = table_row.oid
           AND attribute_row.attnum = key_row.attnum
        ) = ARRAY['company_id', 'status', 'expires_at']::name[]
    ) AS present
  `,
  'company-invitation-names-nullable': `
    SELECT COUNT(*) = 2 AS present
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'company_invitation'
      AND column_name IN ('first_name', 'last_name')
      AND data_type = 'character varying'
      AND character_maximum_length = 100
      AND is_nullable = 'YES'
  `,
  'company-audit-log-table-and-constraints': `
    SELECT (
      to_regclass(format('%I.%I', current_schema(), 'company_audit_log')) IS NOT NULL
      AND (
        SELECT COUNT(*) = 3 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'company_audit_log' AND c.contype = 'f'
          AND (
            (c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (company_id) REFERENCES company(id)%')
            OR (c.confdeltype = 'n' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (actor_company_user_id) REFERENCES company_user(id)%')
            OR (c.confdeltype = 'a' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (actor_user_id) REFERENCES app_user(id)%')
          )
      )
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'company_audit_log'
          AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (company_id, occurred_at)%'
      )
    ) AS present
  `,

  // Migration 4: CreateDomainSchema1791882600000
  'domain-all-34-tables-and-pks': `
    SELECT (
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN (
        'contract', 'compliance_requirement', 'contract_party', 'compliance_record', 'contract_role_assignment', 'activity_log', 'comment', 'contract_status_history', 'document', 'conversation', 'document_version', 'conversation_participant', 'contract_stage', 'notification', 'message', 'document_link', 'invoice', 'milestone', 'invoice_line_item', 'contract_variation', 'contract_site', 'hse_incident', 'hse_inspection', 'hse_inspection_finding', 'hse_corrective_action', 'invoice_adjustment', 'payment', 'hse_incident_person', 'inventory_item', 'site_daily_log', 'inventory_transaction', 'site_daily_log_equipment', 'site_daily_log_visitor', 'site_daily_log_labour'
      )) = 34
      AND
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'id' AND data_type = 'character varying' AND character_maximum_length = 26 AND table_name IN (
        'contract', 'compliance_requirement', 'contract_party', 'compliance_record', 'contract_role_assignment', 'activity_log', 'comment', 'contract_status_history', 'document', 'conversation', 'document_version', 'conversation_participant', 'contract_stage', 'notification', 'message', 'document_link', 'invoice', 'milestone', 'invoice_line_item', 'contract_variation', 'contract_site', 'hse_incident', 'hse_inspection', 'hse_inspection_finding', 'hse_corrective_action', 'invoice_adjustment', 'payment', 'hse_incident_person', 'inventory_item', 'site_daily_log', 'inventory_transaction', 'site_daily_log_equipment', 'site_daily_log_visitor', 'site_daily_log_labour'
      )) = 34
      AND
      (SELECT COUNT(DISTINCT tc.table_name) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema WHERE tc.table_schema = current_schema() AND tc.constraint_type = 'PRIMARY KEY' AND kcu.column_name = 'id' AND tc.table_name IN (
        'contract', 'compliance_requirement', 'contract_party', 'compliance_record', 'contract_role_assignment', 'activity_log', 'comment', 'contract_status_history', 'document', 'conversation', 'document_version', 'conversation_participant', 'contract_stage', 'notification', 'message', 'document_link', 'invoice', 'milestone', 'invoice_line_item', 'contract_variation', 'contract_site', 'hse_incident', 'hse_inspection', 'hse_inspection_finding', 'hse_corrective_action', 'invoice_adjustment', 'payment', 'hse_incident_person', 'inventory_item', 'site_daily_log', 'inventory_transaction', 'site_daily_log_equipment', 'site_daily_log_visitor', 'site_daily_log_labour'
      )) = 34
    ) AS present
  `,
  'domain-all-45-enum-types': `
    SELECT COUNT(*) = 45 AS present
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema()
      AND t.typname IN (
        'contract_contract_type_enum', 'contract_status_enum', 'compliance_requirement_category_enum',
        'compliance_requirement_applies_to_party_type_enum', 'compliance_requirement_frequency_enum',
        'contract_party_party_type_enum', 'compliance_record_status_enum',
        'contract_role_assignment_contract_role_enum', 'comment_entity_type_enum', 'comment_visibility_enum',
        'contract_status_history_from_status_enum', 'contract_status_history_to_status_enum',
        'document_category_enum', 'document_visibility_enum', 'document_status_enum',
        'conversation_conversation_type_enum', 'conversation_workspace_enum', 'contract_stage_status_enum',
        'notification_channel_enum', 'notification_status_enum', 'document_link_entity_type_enum',
        'invoice_invoice_type_enum', 'invoice_status_enum', 'milestone_status_enum',
        'contract_variation_variation_type_enum', 'contract_variation_status_enum',
        'contract_site_status_enum', 'hse_incident_incident_type_enum', 'hse_incident_severity_enum',
        'hse_incident_status_enum', 'hse_inspection_inspection_type_enum', 'hse_inspection_status_enum',
        'hse_inspection_overall_result_enum', 'hse_inspection_finding_result_enum',
        'hse_inspection_finding_risk_level_enum', 'hse_corrective_action_priority_enum',
        'hse_corrective_action_status_enum', 'invoice_adjustment_adjustment_type_enum',
        'payment_payment_method_enum', 'payment_status_enum', 'hse_incident_person_involvement_enum',
        'site_daily_log_weather_condition_enum', 'site_daily_log_status_enum',
        'inventory_transaction_transaction_type_enum', 'site_daily_log_equipment_condition_enum'
      )
  `,
  'domain-core-table-columns': `
    SELECT (
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND (
        (table_name = 'contract' AND column_name IN ('reference_number', 'contract_type', 'status', 'original_value_minor', 'currency_code', 'start_date', 'end_date'))
        OR (table_name = 'contract_party' AND column_name IN ('contract_id', 'company_id', 'party_type'))
        OR (table_name = 'contract_role_assignment' AND column_name IN ('contract_party_id', 'company_user_id', 'company_id', 'contract_role', 'assigned_at'))
        OR (table_name = 'activity_log' AND column_name IN ('contract_id', 'company_id', 'actor_user_id', 'action', 'entity_type', 'entity_id', 'summary', 'occurred_at'))
      )) = 23
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'contract' AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%(reference_number)%'
      )
    ) AS present
  `,
  'domain-core-foreign-keys': `
    SELECT COUNT(*) >= 6 AS present
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    WHERE n.nspname = current_schema() AND c.contype = 'f'
      AND (
        (child.relname = 'contract_party' AND parent.relname = 'contract')
        OR (child.relname = 'contract_party' AND parent.relname = 'company')
        OR (child.relname = 'contract_role_assignment' AND parent.relname = 'contract_party')
        OR (child.relname = 'contract_role_assignment' AND parent.relname = 'company_user')
        OR (child.relname = 'compliance_record' AND parent.relname = 'contract')
        OR (child.relname = 'activity_log' AND parent.relname = 'contract')
      )
  `,

  // Migration 5: ContractRoleRevocationNullable1791882600001
  'revocation-columns-nullable': `
    SELECT COUNT(*) = 2 AS present
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'contract_role_assignment'
      AND column_name IN ('revoked_at', 'revoked_by_id')
      AND is_nullable = 'YES'
  `,
  'active-assignment-index': `
    SELECT EXISTS (
      SELECT 1
      FROM pg_index index_row
      JOIN pg_class index_table ON index_table.oid = index_row.indexrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = index_table.relnamespace
      JOIN pg_class table_row ON table_row.oid = index_row.indrelid
      WHERE namespace_row.nspname = current_schema()
        AND table_row.relname = 'contract_role_assignment'
        AND index_row.indisunique
        AND pg_get_indexdef(index_row.indexrelid) ILIKE '%USING btree (contract_party_id, company_user_id, contract_role)%'
        AND pg_get_indexdef(index_row.indexrelid) ILIKE '%(revoked_at IS NULL)%'
    ) AS present
  `,

  // Migration 6: NullableActivityRequestContext1791882600002
  'activity-context-nullable': `
    SELECT COUNT(*) = 3 AS present
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'activity_log'
      AND column_name IN ('ip_address', 'user_agent', 'request_id')
      AND is_nullable = 'YES'
  `,

  // Migration 7: WorkspaceAdminRole1791882600003
  'workspace-admin-column': `
    SELECT COUNT(*) = 1 AS present
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'contract_role_assignment'
      AND column_name = 'is_workspace_admin'
      AND data_type = 'boolean'
      AND is_nullable = 'NO'
      AND column_default IN ('false', 'false::boolean')
  `,
  'company-scope-unique-keys': `
    SELECT COUNT(*) = 2 AS present
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN ('uq_contract_party_id_company', 'uq_company_user_id_company')
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(id, company_id)%'
  `,
  'assignment-company-scope-foreign-keys': `
    SELECT COUNT(*) = 2 AS present
    FROM pg_constraint constraint_row
    JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
    JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
    WHERE namespace_row.nspname = current_schema()
      AND table_row.relname = 'contract_role_assignment'
      AND constraint_row.contype = 'f'
      AND (
        (constraint_row.conname = 'fk_role_assignment_party_company'
          AND pg_get_constraintdef(constraint_row.oid) ILIKE
            'FOREIGN KEY (contract_party_id, company_id) REFERENCES contract_party(id, company_id) ON DELETE CASCADE')
        OR
        (constraint_row.conname = 'fk_role_assignment_member_company'
          AND pg_get_constraintdef(constraint_row.oid) ILIKE
            'FOREIGN KEY (company_user_id, company_id) REFERENCES company_user(id, company_id) ON DELETE CASCADE')
      )
  `,

  // Migration 8: ContractRoleInvitations1791882600004
  'role-invitation-columns-and-types': `
    SELECT (
      (SELECT COUNT(*) = 15
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'contract_role_invitation'
         AND (
        (column_name = 'id' AND data_type = 'character varying' AND character_maximum_length = 26)
        OR (column_name = 'contract_party_id' AND data_type = 'character varying' AND character_maximum_length = 26)
        OR (column_name = 'company_id' AND data_type = 'character varying' AND character_maximum_length = 26)
        OR (column_name = 'invited_by_id' AND data_type = 'character varying' AND character_maximum_length = 26)
        OR (column_name = 'email' AND data_type = 'character varying' AND character_maximum_length = 320)
        OR (column_name = 'contract_role' AND udt_name = 'contract_role_assignment_contract_role_enum')
        OR (column_name = 'workspace' AND data_type = 'character varying' AND character_maximum_length = 20)
        OR (column_name = 'is_workspace_admin' AND data_type = 'boolean')
        OR (column_name = 'token_hash' AND data_type = 'character varying' AND character_maximum_length = 64)
        OR (column_name = 'status' AND data_type = 'character varying' AND character_maximum_length = 20)
        OR (column_name = 'expires_at' AND is_nullable = 'NO')
        OR (column_name = 'responded_at' AND is_nullable = 'YES')
        OR (column_name = 'revoked_at' AND is_nullable = 'YES')
           OR (column_name = 'created_at' AND is_nullable = 'NO')
           OR (column_name = 'updated_at' AND is_nullable = 'NO')
         ))
      AND EXISTS (
        SELECT 1
        FROM pg_constraint constraint_row
        JOIN pg_class table_row
          ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace namespace_row
          ON namespace_row.oid = table_row.relnamespace
        WHERE namespace_row.nspname = current_schema()
          AND table_row.relname = 'contract_role_invitation'
          AND constraint_row.contype = 'p'
          AND pg_get_constraintdef(constraint_row.oid, true) = 'PRIMARY KEY (id)'
      )
    ) AS present
  `,
  'role-invitation-check-constraints': `
    SELECT (
      EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = current_schema() AND t.relname = 'contract_role_invitation' AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%workspace%project%hse%finance%')
      AND
      EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = current_schema() AND t.relname = 'contract_role_invitation' AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%status%pending%accepted%rejected%expired%revoked%')
    ) AS present
  `,
  'role-invitation-foreign-keys': `
    SELECT COUNT(*) = 5 AS present
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    WHERE n.nspname = current_schema()
      AND child.relname = 'contract_role_invitation'
      AND c.contype = 'f'
      AND c.confdeltype = 'c'
      AND (
        (parent.relname = 'contract_party' AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (contract_party_id) REFERENCES contract_party(id)%')
        OR (parent.relname = 'company' AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (company_id) REFERENCES company(id)%')
        OR (parent.relname = 'company_user' AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (invited_by_id) REFERENCES company_user(id)%')
        OR (parent.relname = 'contract_party' AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (contract_party_id, company_id) REFERENCES contract_party(id, company_id)%')
        OR (parent.relname = 'company_user' AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (invited_by_id, company_id) REFERENCES company_user(id, company_id)%')
      )
  `,
  'role-invitation-token-index-def': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'contract_role_invitation'
        AND ix.indisunique
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (token_hash)%'
    ) AS present
  `,
  'role-invitation-pending-index-def': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'contract_role_invitation'
        AND ix.indisunique
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (contract_party_id, email, contract_role)%'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%status%pending%'
    ) AS present
  `,
  'role-invitation-expiry-index-def': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'contract_role_invitation'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (contract_party_id, status, expires_at)%'
    ) AS present
  `,

  // Migration 9: ContractLifecycle1792862700000
  'contract-lifecycle-columns-and-nullability': `
    SELECT (
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'contract' AND column_name IN ('created_by_company_id', 'deleted_at', 'deleted_by_company_user_id')) = 3
      AND
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND is_nullable = 'YES' AND (
        (table_name = 'contract' AND column_name IN ('description', 'advance_payment_rate_bps', 'liquidated_damages_per_day_minor', 'revised_end_date', 'actual_completion_date'))
        OR (table_name = 'contract_party' AND column_name IN ('signatory_first_name', 'signatory_last_name', 'signatory_title', 'signed_at'))
        OR (table_name = 'contract_status_history' AND column_name IN ('from_status', 'reason'))
      )) = 11
    ) AS present
  `,
  'contract-lifecycle-foreign-keys': `
    SELECT (
      (SELECT COUNT(*) FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_class parent ON parent.oid = c.confrelid JOIN pg_namespace n ON n.oid = child.relnamespace WHERE n.nspname = current_schema() AND child.relname = 'contract' AND c.contype = 'f' AND (
        (parent.relname = 'company' AND c.confdeltype = 'r' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (created_by_company_id) REFERENCES company(id)%')
        OR (parent.relname = 'company_user' AND c.confdeltype = 'n' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (deleted_by_company_user_id) REFERENCES company_user(id)%')
      )) = 2
    ) AS present
  `,
  'contract-workspace-table-and-constraints': `
    SELECT (
      to_regclass(format('%I.%I', current_schema(), 'contract_workspace')) IS NOT NULL
      AND (
        SELECT COUNT(*) = 2 FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = current_schema() AND tc.table_name = 'contract_workspace' AND tc.constraint_type = 'PRIMARY KEY'
          AND kcu.column_name IN ('contract_id', 'workspace')
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'contract_workspace' AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%workspace%project%hse%finance%'
      )
      AND (
        SELECT COUNT(*) = 2 FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_class parent ON parent.oid = c.confrelid JOIN pg_namespace n ON n.oid = child.relnamespace
        WHERE n.nspname = current_schema() AND child.relname = 'contract_workspace' AND c.contype = 'f'
          AND (
            (parent.relname = 'contract' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (contract_id) REFERENCES contract(id)%')
            OR (parent.relname = 'company_user' AND c.confdeltype = 'n' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (created_by_company_user_id) REFERENCES company_user(id)%')
          )
      )
    ) AS present
  `,
  'contract-lifecycle-workspace-seed-data': `
    SELECT NOT EXISTS (
      SELECT 1
      FROM contract c
      CROSS JOIN (VALUES ('project'), ('hse'), ('finance')) AS w(ws)
      LEFT JOIN contract_workspace cw ON cw.contract_id = c.id AND cw.workspace = w.ws
      WHERE cw.contract_id IS NULL
    ) AS present
  `,
  'contract-party-invitation-table-and-constraints': `
    SELECT (
      to_regclass(format('%I.%I', current_schema(), 'contract_party_invitation')) IS NOT NULL
      AND (
        SELECT COUNT(*) = 4 FROM pg_constraint c
        JOIN pg_class child ON child.oid = c.conrelid
        JOIN pg_class parent ON parent.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = child.relnamespace
        WHERE n.nspname = current_schema() AND child.relname = 'contract_party_invitation' AND c.contype = 'f'
          AND (
            (parent.relname = 'contract_party' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (source_contract_party_id, source_company_id) REFERENCES contract_party(id, company_id)%')
            OR (parent.relname = 'company' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (target_company_id) REFERENCES company(id)%')
            OR (parent.relname = 'company_user' AND c.confdeltype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (invited_by_company_user_id, source_company_id) REFERENCES company_user(id, company_id)%')
            OR (parent.relname = 'company_user' AND c.confdeltype = 'n' AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (accepted_by_company_user_id) REFERENCES company_user(id)%')
          )
      )
      AND (
        SELECT COUNT(*) = 2 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'contract_party_invitation' AND c.contype = 'c'
          AND (
            pg_get_constraintdef(c.oid) ILIKE '%party_type%contractor%subcontractor%'
            OR pg_get_constraintdef(c.oid) ILIKE '%status%pending%accepted%rejected%expired%revoked%'
          )
      )
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'contract_party_invitation'
          AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (token_hash)%'
      )
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'contract_party_invitation'
          AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (source_contract_party_id, target_company_id, party_type)%'
          AND pg_get_indexdef(ix.indexrelid) ILIKE '%status%pending%'
      )
      AND EXISTS (
        SELECT 1 FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema() AND t.relname = 'contract_party_invitation'
          AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (target_company_id, status, expires_at)%'
      )
    ) AS present
  `,
  'status-history-index-def': `
    SELECT EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema()
        AND t.relname = 'contract_status_history'
        AND pg_get_indexdef(ix.indexrelid) ILIKE '%USING btree (contract_id, changed_at, id)%'
    ) AS present
  `,

  // Backwards-compatible aliases for previously defined probe IDs
  'identity-table-columns': `
    SELECT COUNT(*) = 5 AS present
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('app_user', 'company', 'company_user', 'company_invitation', 'user_session')
  `,
  'identity-primary-keys': `
    SELECT COUNT(*) = 5 AS present
    FROM (
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('app_user', 'company', 'company_user', 'company_invitation', 'user_session')
        AND column_name = 'id'
        AND data_type = 'character varying'
        AND character_maximum_length = 26
    ) identity_ids
  `,
  'email-verification-table': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'email_verification_token')) IS NOT NULL AS present
  `,
  'email-verification-index': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'ix_email_verification_user_created')) IS NOT NULL AS present
  `,
  'company-user-unique-index': `
    SELECT (
      to_regclass(format('%I.%I', current_schema(), 'uq_company_user_company_user')) IS NOT NULL
      OR to_regclass(format('%I.%I', current_schema(), 'uq_company_user_active_company_user')) IS NOT NULL
    ) AS present
  `,
  'company-user-active-index': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'uq_company_user_active_company_user')) IS NOT NULL AS present
  `,
  'company-invitation-indexes': `
    SELECT COUNT(*) = 2 AS present
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN ('uq_company_invitation_pending_company_email', 'ix_company_invitation_company_status_expiry')
  `,
  'company-audit-log': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'company_audit_log')) IS NOT NULL
      AND to_regclass(format('%I.%I', current_schema(), 'ix_company_audit_log_company_occurred')) IS NOT NULL AS present
  `,
  'domain-core-tables': `
    SELECT COUNT(*) = 4 AS present
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('contract', 'contract_party', 'contract_role_assignment', 'activity_log')
  `,
  'domain-enums': `
    SELECT to_regtype(format('%I.%I', current_schema(), 'contract_role_assignment_contract_role_enum')) IS NOT NULL AS present
  `,
  'domain-foreign-keys-and-indexes': `
    SELECT COUNT(*) >= 3 AS present
    FROM information_schema.table_constraints
    WHERE constraint_schema = current_schema()
      AND constraint_type = 'FOREIGN KEY'
      AND table_name IN ('contract', 'contract_party', 'contract_role_assignment')
  `,
  'role-invitation-columns': `
    SELECT COUNT(*) >= 14 AS present
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'contract_role_invitation'
  `,
  'role-invitation-constraints': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'contract_role_invitation')) IS NOT NULL
      AND (SELECT COUNT(*) >= 4 FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = 'contract_role_invitation'
          AND constraint_type IN ('FOREIGN KEY', 'CHECK')) AS present
  `,
  'role-invitation-indexes': `
    SELECT COUNT(*) >= 3 AS present
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'contract_role_invitation'
      AND (
        indexdef ILIKE '%UNIQUE%'
        OR indexname = 'ix_contract_role_invitation_party_status_expiry'
      )
  `,
  'contract-lifecycle-columns': `
    SELECT COUNT(*) >= 3 AS present
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'contract'
      AND column_name IN ('created_by_company_id', 'deleted_at', 'deleted_by_company_user_id')
  `,
  'contract-workspace': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'contract_workspace')) IS NOT NULL AS present
  `,
  'contract-party-invitation': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'contract_party_invitation')) IS NOT NULL AS present
  `,
  'status-history-index': `
    SELECT to_regclass(format('%I.%I', current_schema(), 'ix_contract_status_history_contract_changed')) IS NOT NULL AS present
  `,
};

export const dataPrecheckSql: Record<string, string> = {
  'duplicate-active-memberships': `
    SELECT COUNT(*)::int AS count FROM (
      SELECT 1 FROM company_user
      WHERE status = 'active' AND left_at IS NULL
      GROUP BY company_id, user_id HAVING COUNT(*) > 1
    ) duplicates
  `,
  'duplicate-pending-invitations': `
    SELECT COUNT(*)::int AS count FROM (
      SELECT 1 FROM company_invitation
      WHERE status = 'pending'
      GROUP BY company_id, email HAVING COUNT(*) > 1
    ) duplicates
  `,
  'expired-pending-invitations': `
    SELECT COUNT(*)::int AS count FROM company_invitation
    WHERE status = 'pending' AND expires_at <= now()
  `,
  'duplicate-active-assignments': `
    SELECT COUNT(*)::int AS count FROM (
      SELECT 1 FROM contract_role_assignment
      WHERE revoked_at IS NULL
      GROUP BY contract_party_id, company_user_id, contract_role
      HAVING COUNT(*) > 1
    ) duplicates
  `,
  'cross-company-role-assignments': `
    SELECT COUNT(*)::int AS count
    FROM contract_role_assignment assignment
    LEFT JOIN contract_party party
      ON party.id = assignment.contract_party_id AND party.company_id = assignment.company_id
    LEFT JOIN company_user member
      ON member.id = assignment.company_user_id AND member.company_id = assignment.company_id
    WHERE party.id IS NULL OR member.id IS NULL
  `,
};

export const dataPrecheckColumns: Record<string, Array<[string, string]>> = {
  'duplicate-active-memberships': [
    ['company_user', 'status'],
    ['company_user', 'left_at'],
    ['company_user', 'company_id'],
    ['company_user', 'user_id'],
  ],
  'duplicate-pending-invitations': [
    ['company_invitation', 'status'],
    ['company_invitation', 'company_id'],
    ['company_invitation', 'email'],
  ],
  'expired-pending-invitations': [
    ['company_invitation', 'status'],
    ['company_invitation', 'expires_at'],
  ],
  'duplicate-active-assignments': [
    ['contract_role_assignment', 'revoked_at'],
    ['contract_role_assignment', 'contract_party_id'],
    ['contract_role_assignment', 'company_user_id'],
    ['contract_role_assignment', 'contract_role'],
  ],
  'cross-company-role-assignments': [
    ['contract_role_assignment', 'contract_party_id'],
    ['contract_role_assignment', 'company_user_id'],
    ['contract_role_assignment', 'company_id'],
    ['contract_party', 'id'],
    ['contract_party', 'company_id'],
    ['company_user', 'id'],
    ['company_user', 'company_id'],
  ],
};

export function normalizeHost(host: string): string {
  const normalized = host.toLowerCase().trim();
  const lower =
    normalized.startsWith('[') && normalized.endsWith(']')
      ? normalized.slice(1, -1)
      : normalized;
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') {
    return '127.0.0.1';
  }
  return lower;
}

export function databaseIdentity(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('PostgreSQL URL protocol is required.');
    }
    const ambiguousConnectionKeys = new Set([
      'host',
      'hostaddr',
      'port',
      'dbname',
      'database',
      'service',
      'servicefile',
    ]);
    if (
      parsed.hash ||
      [...parsed.searchParams.keys()].some((key) =>
        ambiguousConnectionKeys.has(key.toLowerCase()),
      )
    ) {
      throw new Error(
        'Connection URL overrides and fragments are not accepted for offline target identity checks.',
      );
    }
    const database = decodeURIComponent(
      parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, ''),
    );
    if (!database) {
      throw new Error('Database name is missing.');
    }
    const host = normalizeHost(parsed.hostname);
    if (!host) {
      throw new Error('Host name is missing.');
    }
    const port = parsed.port || '5432';
    return `${host}:${port}/${database}`;
  } catch (err: unknown) {
    throw new Error(
      `Invalid database connection string: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function isSameDatabaseTarget(urlA: string, urlB: string): boolean {
  return databaseIdentity(urlA) === databaseIdentity(urlB);
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[redacted PostgreSQL URL]')
    .replace(/:[^:@/\s]+@/g, ':[REDACTED]@')
    .replace(
      /\b(password|passwd|pwd|token|secret|api[_-]?key)\s*[=:]\s*[^&\s,;]+/gi,
      '$1=[REDACTED]',
    )
    .replace(
      /\b(parameters?|bind values?)\s*[:=]\s*\[[^\]]*\]/gi,
      '$1=[REDACTED]',
    );
}
