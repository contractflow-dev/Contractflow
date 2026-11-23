-- ContractFlow: legacy milestone status report (READ-ONLY)
--
-- Run BEFORE deciding how legacy milestones enter the Stages and Milestones
-- workflow (approved 22 November 2026, rule 9). It changes nothing: the
-- whole script runs in a READ ONLY transaction that is rolled back.
--
-- Milestones with the statuses active, delayed or at_risk can't be started,
-- submitted or decided by the workflow. This report shows what each one
-- holds, so a mapping can be decided from its actual meaning. The decided
-- mapping is then applied with:
--
--   pnpm --filter @contractflow/api milestones:legacy-transition -- \
--     --map <status>=<planned|in_progress> [--contract <id>] [--apply]
--
-- which is a dry run until --apply is given, and keeps each original status
-- in milestone.legacy_status. Approved and completed milestones are never
-- touched.
--
-- Run it only as an authorized operator, against the intended database. The
-- output names contracts and milestones; don't share it beyond the people
-- deciding the mapping. Requires migration MilestoneWorkflow1793800000000.

BEGIN TRANSACTION READ ONLY;

-- 1. How many milestones are in each status, and how many already moved.
SELECT
  m.status::text                                  AS status,
  count(*)                                        AS milestones,
  count(*) FILTER (WHERE m.legacy_status IS NOT NULL) AS already_transitioned,
  count(DISTINCT m.contract_id)                   AS contracts
FROM milestone m
GROUP BY m.status
ORDER BY m.status::text;

-- 2. Every legacy milestone, with what it records, to decide its mapping.
SELECT
  m.status::text                 AS status,
  c.reference_number             AS contract_reference,
  c.status::text                 AS contract_status,
  c.deleted_at IS NOT NULL       AS contract_archived,
  s.sequence                     AS stage_sequence,
  s.name                         AS stage_name,
  s.status::text                 AS stage_status,
  m.sequence                     AS milestone_sequence,
  m.id                           AS milestone_id,
  m.title,
  m.progress_bps,
  m.approved_bps,
  m.due_date,
  m.revised_due_date,
  m.completed_date,
  m.submitted_at,
  m.approved_at,
  m.rejection_reason,
  m.legacy_status,
  (SELECT count(*) FROM milestone_submission ms WHERE ms.milestone_id = m.id) AS submissions
FROM milestone m
JOIN contract c ON c.id = m.contract_id
LEFT JOIN contract_stage s ON s.id = m.contract_stage_id
WHERE m.status::text IN ('active', 'delayed', 'at_risk')
ORDER BY c.reference_number, s.sequence, m.sequence;

-- 3. Hints for the decision (nothing is decided here):
--    * a completed_date or approved_at on a legacy milestone suggests the work
--      was accepted: review it by hand rather than mapping it to in_progress;
--    * progress_bps above 0 or a submitted_at suggests work had started
--      (in_progress rather than planned).
SELECT
  m.id AS milestone_id,
  m.status::text AS status,
  m.title,
  CASE
    WHEN m.completed_date IS NOT NULL OR m.approved_at IS NOT NULL
      THEN 'review by hand: records an approval or completion'
    WHEN m.progress_bps > 0 OR m.submitted_at IS NOT NULL
      THEN 'work had started: in_progress is the likely mapping'
    ELSE 'no work recorded: planned is the likely mapping'
  END AS hint
FROM milestone m
WHERE m.status::text IN ('active', 'delayed', 'at_risk')
ORDER BY hint, m.id;

ROLLBACK;
