-- =====================================================================
-- ContractFlow — PostgreSQL Schema (Multi-Tenant, Implementation)
--
-- Fixes applied vs. the previous version:
--   POINT 1 — contract.company_id removed entirely. A contract has TWO
--             tenants (client_id, contractor_id), not one, so a single
--             company_id column was structurally wrong.
--   POINT 2 — company_id removed from every child table (stage,
--             document, activity_log, hse_incident_report,
--             hse_inspection, site_daily_log, compliance_record,
--             milestone, payment). These were denormalized copies of
--             the contract's tenant with nothing stopping them from
--             drifting out of sync. Tenant is now always derived by
--             joining back to contract.client_id / contractor_id —
--             there is exactly one place tenancy is recorded.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS contractflow;
SET search_path TO contractflow;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- ENUM TYPES
-- =====================================================================

CREATE TYPE company_type_enum        AS ENUM ('Client', 'Contractor');
CREATE TYPE active_inactive_enum     AS ENUM ('Active', 'Inactive');
CREATE TYPE active_suspended_enum    AS ENUM ('Active', 'Suspended');
CREATE TYPE workspace_enum           AS ENUM ('HSE', 'Client', 'Finance', 'Contractor');
CREATE TYPE contract_type_enum       AS ENUM ('Service', 'Supply', 'EPC', 'Maintenance');
CREATE TYPE currency_enum            AS ENUM ('NGN', 'USD', 'EUR', 'GBP');
CREATE TYPE contract_status_enum     AS ENUM ('Draft', 'Active', 'Suspended', 'Completed');
CREATE TYPE document_type_enum       AS ENUM ('Contract', 'Certificate', 'Report', 'Invoice', 'HSE');
CREATE TYPE expiry_status_enum       AS ENUM ('Valid', 'Expiring', 'Expired');
CREATE TYPE verification_status_enum AS ENUM ('Pending', 'Verified', 'Rejected');
CREATE TYPE activity_type_enum       AS ENUM ('Upload', 'Approval', 'Payment', 'Comment', 'Submission');
CREATE TYPE action_result_enum       AS ENUM ('Success', 'Failure');

CREATE TYPE incident_type_enum       AS ENUM ('Near Miss', 'Injury', 'Equipment Fault', 'Leak', 'Unsafe Act');
CREATE TYPE severity_enum            AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE incident_status_enum     AS ENUM ('Open', 'Investigating', 'Closed');

CREATE TYPE inspection_type_enum     AS ENUM ('Toolbox Talk', 'PPE Check', 'Permit-to-Work', 'Site Walk');
CREATE TYPE inspection_result_enum   AS ENUM ('Pass', 'Fail', 'Flagged');

CREATE TYPE approval_status_enum     AS ENUM ('Compliant', 'Non-compliant', 'Pending');
CREATE TYPE milestone_status_enum    AS ENUM ('Not Due', 'Pending', 'Approved', 'Paid');
CREATE TYPE payment_method_enum      AS ENUM ('Bank Transfer', 'Cheque', 'Other');

-- =====================================================================
-- COMPANY — the tenant root
-- =====================================================================
CREATE TABLE company (
    company_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name        TEXT NOT NULL,
    company_type        company_type_enum NOT NULL,
    registration_number TEXT,
    tax_id               TEXT,
    jqs_number           TEXT,
    verification_status  TEXT,
    address              TEXT,
    country              TEXT,
    contact_email        TEXT,
    contact_phone        TEXT,
    status               active_inactive_enum NOT NULL DEFAULT 'Active',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_company_email CHECK (contact_email IS NULL OR contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
COMMENT ON TABLE company IS 'A contractor or client organization — the tenant root of the platform.';

-- =====================================================================
-- APP_USER — global login identity. NOT linked to company directly.
-- =====================================================================
CREATE TABLE app_user (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    status        active_suspended_enum NOT NULL DEFAULT 'Active',
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_email CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
COMMENT ON TABLE app_user IS 'One login per person, platform-wide. Company membership lives in user_company_association, not here.';

-- =====================================================================
-- USER_COMPANY_ASSOCIATION — which companies a user belongs to, and
-- their role/workspace at each. This is what lets John be PM at
-- Company A and Finance Director at Company B on one login.
-- =====================================================================
CREATE TABLE user_company_association (
    user_company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    workspace       workspace_enum NOT NULL,
    access_level    TEXT,
    status          active_suspended_enum NOT NULL DEFAULT 'Active',
    date_joined     DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uq_user_company UNIQUE (user_id, company_id, role)
);
COMMENT ON TABLE user_company_association IS 'Membership + role/workspace for a user at a specific company. A user has one row here per company they work for.';

-- =====================================================================
-- CONTRACT
-- No single company_id: a contract has TWO tenants, named explicitly.
-- current_stage_id FK added after STAGE exists (circular dependency).
-- =====================================================================
CREATE TABLE contract (
    contract_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number   TEXT NOT NULL UNIQUE,
    client_id         UUID NOT NULL REFERENCES company(company_id),
    contractor_id     UUID NOT NULL REFERENCES company(company_id),
    contract_title    TEXT NOT NULL,
    contract_type     contract_type_enum NOT NULL,
    start_date        DATE,
    end_date          DATE,
    contract_value    NUMERIC(18,2),
    currency          currency_enum NOT NULL DEFAULT 'NGN',
    scope             TEXT,
    current_stage_id  UUID,
    contract_status   contract_status_enum NOT NULL DEFAULT 'Draft',
    project_location  TEXT,
    created_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_contract_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_contract_parties CHECK (client_id <> contractor_id)
);
COMMENT ON TABLE contract IS 'A contract between a client Company and a contractor Company — its two tenants.';

-- =====================================================================
-- CONTRACT_ROLE_ASSIGNMENT — which contracts a user can see, and
-- which company "hat" they're wearing on that contract.
-- =====================================================================
CREATE TABLE contract_role_assignment (
    assignment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    company_id     UUID NOT NULL REFERENCES company(company_id),
    contract_id    UUID NOT NULL REFERENCES contract(contract_id) ON DELETE CASCADE,
    contract_role  TEXT NOT NULL,
    workspace      workspace_enum NOT NULL,
    status         active_suspended_enum NOT NULL DEFAULT 'Active',
    assigned_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uq_contract_assignment UNIQUE (user_id, contract_id, company_id)
);
COMMENT ON TABLE contract_role_assignment IS 'Which contracts a user can access, and under which company they are acting on each one.';

-- Guard: company_id here must be one of the contract's two actual tenants.
CREATE OR REPLACE FUNCTION trg_validate_contract_role_company()
RETURNS TRIGGER AS $$
DECLARE
    v_client_id     UUID;
    v_contractor_id UUID;
BEGIN
    SELECT client_id, contractor_id INTO v_client_id, v_contractor_id
    FROM contract WHERE contract_id = NEW.contract_id;

    IF NEW.company_id NOT IN (v_client_id, v_contractor_id) THEN
        RAISE EXCEPTION 'company_id % is not a party (client or contractor) on contract %', NEW.company_id, NEW.contract_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_contract_role_company
    BEFORE INSERT OR UPDATE ON contract_role_assignment
    FOR EACH ROW EXECUTE FUNCTION trg_validate_contract_role_company();

-- =====================================================================
-- STAGE
-- =====================================================================
CREATE TABLE stage (
    stage_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id      UUID NOT NULL REFERENCES contract(contract_id) ON DELETE CASCADE,
    stage_number     INTEGER NOT NULL,
    stage_name       TEXT NOT NULL,
    description      TEXT,
    entry_date       DATE,
    target_date      DATE,
    completion_date  DATE,
    stage_status     TEXT,
    owner_user_id    UUID REFERENCES app_user(user_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stage_sequence UNIQUE (contract_id, stage_number)
);
COMMENT ON TABLE stage IS 'One step in a contract''s lifecycle pipeline. Tenant is derived via contract_id, not stored here.';

ALTER TABLE contract
    ADD CONSTRAINT fk_contract_current_stage
    FOREIGN KEY (current_stage_id) REFERENCES stage(stage_id);

-- =====================================================================
-- DOCUMENT
-- =====================================================================
CREATE TABLE document (
    document_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id          UUID NOT NULL REFERENCES contract(contract_id) ON DELETE CASCADE,
    uploaded_by_user_id  UUID NOT NULL REFERENCES app_user(user_id),
    document_name        TEXT NOT NULL,
    document_type        document_type_enum NOT NULL,
    document_category    TEXT,
    document_number      TEXT,
    version               TEXT,
    issue_date             DATE,
    expiry_date             DATE,
    expiry_status            expiry_status_enum,
    verification_status      verification_status_enum NOT NULL DEFAULT 'Pending',
    verified_by_user_id       UUID REFERENCES app_user(user_id),
    verification_date          DATE,
    file_location                TEXT NOT NULL,
    access_level                  TEXT,
    upload_date                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    comments                         TEXT
);
COMMENT ON TABLE document IS 'A certificate, permit, invoice, report, or contract document. Owning company (if ever needed) is recoverable via uploaded_by_user_id -> user_company_association, not stored redundantly here.';
COMMENT ON COLUMN document.expiry_status IS 'Auto-maintained by trg_document_expiry_status.';

-- =====================================================================
-- ACTIVITY_LOG
-- =====================================================================
CREATE TABLE activity_log (
    activity_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id        UUID NOT NULL REFERENCES contract(contract_id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES app_user(user_id),
    workspace          workspace_enum NOT NULL,
    activity_type      activity_type_enum NOT NULL,
    record_type        TEXT,
    record_id          TEXT,
    old_status         TEXT,
    new_status         TEXT,
    activity_datetime  TIMESTAMPTZ NOT NULL DEFAULT now(),
    comment            TEXT,
    ip_device          TEXT,
    action_result      action_result_enum NOT NULL
);
COMMENT ON TABLE activity_log IS 'Append-only, cross-department audit trail for every contract.';

-- =====================================================================
-- HSE_INCIDENT_REPORT
-- =====================================================================
CREATE TABLE hse_incident_report (
    incident_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id       UUID NOT NULL REFERENCES contract(contract_id),
    reported_by       UUID NOT NULL REFERENCES app_user(user_id),
    incident_type     incident_type_enum NOT NULL,
    severity          severity_enum NOT NULL,
    location          TEXT,
    description       TEXT,
    photo_reference   TEXT,
    reported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status            incident_status_enum NOT NULL DEFAULT 'Open',
    investigating_at  TIMESTAMPTZ,
    closed_date       TIMESTAMPTZ
);

-- =====================================================================
-- HSE_INSPECTION
-- =====================================================================
CREATE TABLE hse_inspection (
    inspection_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id         UUID NOT NULL REFERENCES contract(contract_id),
    conducted_by        UUID NOT NULL REFERENCES app_user(user_id),
    inspection_type     inspection_type_enum NOT NULL,
    inspection_date     DATE NOT NULL,
    result              inspection_result_enum NOT NULL,
    notes               TEXT,
    follow_up_required  BOOLEAN NOT NULL DEFAULT false
);

-- =====================================================================
-- SITE_DAILY_LOG
-- =====================================================================
CREATE TABLE site_daily_log (
    log_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id        UUID NOT NULL REFERENCES contract(contract_id),
    logged_by          UUID NOT NULL REFERENCES app_user(user_id),
    log_date           DATE NOT NULL,
    work_summary       TEXT,
    headcount          INTEGER,
    weather            TEXT,
    equipment_on_site  TEXT,
    delays_blockers    TEXT,
    UNIQUE (contract_id, log_date, logged_by)
);

-- =====================================================================
-- COMPLIANCE_RECORD
-- =====================================================================
CREATE TABLE compliance_record (
    compliance_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID REFERENCES document(document_id),
    contract_id         UUID NOT NULL REFERENCES contract(contract_id),
    worker_name         TEXT NOT NULL,
    certification_type  TEXT NOT NULL,
    approval_status     approval_status_enum NOT NULL DEFAULT 'Pending',
    reviewed_by         UUID REFERENCES app_user(user_id),
    review_date         DATE
);

-- =====================================================================
-- MILESTONE
-- =====================================================================
CREATE TABLE milestone (
    milestone_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id      UUID NOT NULL REFERENCES contract(contract_id),
    linked_stage_id  UUID REFERENCES stage(stage_id),
    milestone_name   TEXT NOT NULL,
    amount           NUMERIC(14,2) NOT NULL,
    currency         currency_enum NOT NULL DEFAULT 'NGN',
    due_date         DATE,
    status           milestone_status_enum NOT NULL DEFAULT 'Not Due',
    approved_date    TIMESTAMPTZ
);

-- =====================================================================
-- PAYMENT
-- No contract_id here — it's recoverable via milestone_id -> milestone
-- .contract_id, so storing it again would reopen the exact Point-2
-- drift risk one level down.
-- =====================================================================
CREATE TABLE payment (
    payment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id  UUID NOT NULL REFERENCES milestone(milestone_id),
    amount_paid   NUMERIC(14,2) NOT NULL,
    payment_date  DATE NOT NULL,
    method        payment_method_enum NOT NULL,
    reference_no  TEXT,
    recorded_by   UUID NOT NULL REFERENCES app_user(user_id),
    disputed      BOOLEAN NOT NULL DEFAULT false
);

-- =====================================================================
-- INDEXES
-- =====================================================================
CREATE INDEX idx_uca_user                ON user_company_association(user_id);
CREATE INDEX idx_uca_company             ON user_company_association(company_id);
CREATE INDEX idx_cra_user                ON contract_role_assignment(user_id);
CREATE INDEX idx_cra_contract            ON contract_role_assignment(contract_id);
CREATE INDEX idx_cra_company             ON contract_role_assignment(company_id);
CREATE INDEX idx_contract_client         ON contract(client_id);
CREATE INDEX idx_contract_contractor     ON contract(contractor_id);
CREATE INDEX idx_contract_current_stage  ON contract(current_stage_id);
CREATE INDEX idx_stage_contract          ON stage(contract_id);
CREATE INDEX idx_document_contract       ON document(contract_id);
CREATE INDEX idx_document_expiry_date    ON document(expiry_date);
CREATE INDEX idx_document_expiry_status  ON document(expiry_status);
CREATE INDEX idx_activity_contract       ON activity_log(contract_id);
CREATE INDEX idx_activity_datetime       ON activity_log(activity_datetime);
CREATE INDEX idx_incident_contract       ON hse_incident_report(contract_id);
CREATE INDEX idx_inspection_contract     ON hse_inspection(contract_id);
CREATE INDEX idx_sitelog_contract_date   ON site_daily_log(contract_id, log_date);
CREATE INDEX idx_compliance_contract     ON compliance_record(contract_id);
CREATE INDEX idx_milestone_contract      ON milestone(contract_id);
CREATE INDEX idx_payment_milestone       ON payment(milestone_id);
CREATE INDEX idx_payment_disputed        ON payment(disputed) WHERE disputed = true;

-- =====================================================================
-- TRIGGERS — timestamps and derived statuses
-- =====================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'contract' THEN
        NEW.updated_date := now();
    ELSIF TG_TABLE_NAME = 'document' THEN
        NEW.last_updated := now();
    ELSE
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_updated  BEFORE UPDATE ON company   FOR EACH ROW EXECUTE FUNCTION trg_set_updated_timestamp();
CREATE TRIGGER trg_user_updated     BEFORE UPDATE ON app_user  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_timestamp();
CREATE TRIGGER trg_contract_updated BEFORE UPDATE ON contract  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_timestamp();
CREATE TRIGGER trg_stage_updated    BEFORE UPDATE ON stage     FOR EACH ROW EXECUTE FUNCTION trg_set_updated_timestamp();
CREATE TRIGGER trg_document_updated BEFORE UPDATE ON document  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_timestamp();

CREATE OR REPLACE FUNCTION trg_document_expiry_status()
RETURNS TRIGGER AS $$
DECLARE
    expiring_window_days CONSTANT INTEGER := 30;
BEGIN
    IF NEW.expiry_date IS NULL THEN
        NEW.expiry_status := NULL;
    ELSIF NEW.expiry_date < CURRENT_DATE THEN
        NEW.expiry_status := 'Expired';
    ELSIF NEW.expiry_date <= CURRENT_DATE + expiring_window_days THEN
        NEW.expiry_status := 'Expiring';
    ELSE
        NEW.expiry_status := 'Valid';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_expiry_status
    BEFORE INSERT OR UPDATE OF expiry_date ON document
    FOR EACH ROW EXECUTE FUNCTION trg_document_expiry_status();

CREATE OR REPLACE FUNCTION trg_incident_investigating_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Investigating' AND (OLD.status IS DISTINCT FROM 'Investigating') THEN
        NEW.investigating_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incident_investigating_at
    BEFORE UPDATE OF status ON hse_incident_report
    FOR EACH ROW EXECUTE FUNCTION trg_incident_investigating_at();

CREATE OR REPLACE FUNCTION trg_milestone_approved_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
        NEW.approved_date := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_milestone_approved_date
    BEFORE UPDATE OF status ON milestone
    FOR EACH ROW EXECUTE FUNCTION trg_milestone_approved_date();

-- =====================================================================
-- VIEW: vw_pm_whats_holding_progress
-- Client PM "What's Holding Progress" panel. Tenant access for a
-- given user is now checked via:
--   contract.client_id IN (SELECT company_id FROM user_company_association WHERE user_id = :me)
--   OR contract.contractor_id IN (...)
-- rather than a stored company_id — this view itself is unchanged,
-- since it never depended on the removed columns.
-- =====================================================================

CREATE OR REPLACE VIEW vw_pm_whats_holding_progress AS

SELECT
    contract_id,
    'HSE' AS source,
    'Open Incident' AS blocker_type,
    incident_type || ' (' || severity || ') at ' || COALESCE(location, 'unspecified location') AS description,
    reported_at::date AS date_raised
FROM hse_incident_report
WHERE status <> 'Closed'

UNION ALL

SELECT
    contract_id,
    'HSE' AS source,
    'Non-Compliant Certification' AS blocker_type,
    certification_type || ' expired/non-compliant for ' || worker_name AS description,
    COALESCE(review_date, CURRENT_DATE) AS date_raised
FROM compliance_record
WHERE approval_status = 'Non-compliant'

UNION ALL

SELECT
    contract_id,
    'HSE' AS source,
    'Expired Document' AS blocker_type,
    document_name || ' (' || document_type || ') expired' AS description,
    expiry_date AS date_raised
FROM document
WHERE expiry_status = 'Expired'

UNION ALL

SELECT
    m.contract_id,
    'Finance' AS source,
    'Disputed Payment' AS blocker_type,
    'Payment ' || COALESCE(p.reference_no, p.payment_id::text) || ' held for review' AS description,
    p.payment_date AS date_raised
FROM payment p
JOIN milestone m ON m.milestone_id = p.milestone_id
WHERE p.disputed = true

UNION ALL

SELECT
    contract_id,
    'Finance' AS source,
    'Overdue Milestone' AS blocker_type,
    milestone_name || ' overdue since ' || due_date::text AS description,
    due_date AS date_raised
FROM milestone
WHERE status <> 'Paid'
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE

ORDER BY date_raised ASC;

-- =====================================================================
-- End of schema
-- =====================================================================