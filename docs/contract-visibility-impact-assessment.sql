-- ContractFlow: contract visibility impact assessment (READ-ONLY)
--
-- Run BEFORE deploying individual contract visibility. It changes nothing:
-- the whole script runs in a READ ONLY transaction that is rolled back.
--
-- Before the change, every active member of a party company could see the
-- company's contracts. After it:
--   * an ordinary Member sees a contract only through an active
--     CONTRACT_ROLE_ASSIGNMENT on their company's CONTRACT_PARTY row;
--   * a Company Administrator keeps read-only oversight (list, detail,
--     parties, status history) of every contract the company is party to,
--     but no workspace, activity, document or other protected resource
--     without a role.
-- No access is granted or backfilled. Use this report to decide, contract by
-- contract, who should be given a role through the normal role-assignment
-- screens (Contract > Roles), which record who assigned it and when.
--
-- The output contains personal data (names, email addresses). Run it only as
-- an authorized operator, against the intended database, and do not share
-- the output beyond the people deciding the assignments.
--
-- Scope: non-archived contracts, active companies, active memberships
-- (status 'active', left_at IS NULL): exactly the people who could see a
-- contract under the old rule.

BEGIN TRANSACTION READ ONLY;

-- 1. One row per (contract, member who could see it before).
SELECT
  outcome,
  c.id               AS contract_id,
  c.reference_number AS contract_reference,
  c.title            AS contract_title,
  co.id              AS company_id,
  co.name            AS company_name,
  cp.party_type,
  cu.id              AS company_user_id,
  u.id               AS user_id,
  u.email            AS user_email,
  u.first_name,
  u.last_name,
  cu.company_role,
  is_company_admin,
  has_active_assignment
FROM (
  SELECT
    cp.id AS party_id,
    cu.id AS member_id,
    cu.company_role = 'Company Administrator' AS is_company_admin,
    EXISTS (
      SELECT 1
      FROM contract_role_assignment a
      WHERE a.contract_party_id = cp.id
        AND a.company_user_id = cu.id
        AND a.company_id = cp.company_id
        AND a.revoked_at IS NULL
    ) AS has_active_assignment
  FROM contract_party cp
  JOIN company_user cu
    ON cu.company_id = cp.company_id
   AND cu.status = 'active'
   AND cu.left_at IS NULL
) access
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN access.has_active_assignment THEN 'KEEPS: individual role'
    WHEN access.is_company_admin THEN 'KEEPS: admin read-only oversight'
    ELSE 'LOSES: no role on this contract'
  END AS outcome
) decided
JOIN contract_party cp ON cp.id = access.party_id
JOIN contract c        ON c.id = cp.contract_id AND c.deleted_at IS NULL
JOIN company co        ON co.id = cp.company_id AND co.status = 'active'
JOIN company_user cu   ON cu.id = access.member_id
JOIN app_user u        ON u.id = cu.user_id
ORDER BY outcome DESC, co.name, c.reference_number, u.email;

-- 2. Summary per company and outcome.
SELECT
  co.name AS company_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM contract_role_assignment a
      WHERE a.contract_party_id = cp.id
        AND a.company_user_id = cu.id
        AND a.company_id = cp.company_id
        AND a.revoked_at IS NULL
    ) THEN 'KEEPS: individual role'
    WHEN cu.company_role = 'Company Administrator'
      THEN 'KEEPS: admin read-only oversight'
    ELSE 'LOSES: no role on this contract'
  END AS outcome,
  COUNT(*)                    AS member_contract_pairs,
  COUNT(DISTINCT cu.id)       AS members,
  COUNT(DISTINCT c.id)        AS contracts
FROM contract_party cp
JOIN contract c      ON c.id = cp.contract_id AND c.deleted_at IS NULL
JOIN company co      ON co.id = cp.company_id AND co.status = 'active'
JOIN company_user cu ON cu.company_id = cp.company_id
                    AND cu.status = 'active'
                    AND cu.left_at IS NULL
GROUP BY co.name, outcome
ORDER BY co.name, outcome DESC;

ROLLBACK;
