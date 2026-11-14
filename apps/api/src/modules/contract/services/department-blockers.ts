import {
  EContractStatus,
  EDepartmentBlockerType,
  type DepartmentBlocker,
  type DepartmentBlockerHolder,
} from '@contractflow/contracts-schema';
import type { IDepartmentContractRecord } from '../interfaces/company-department-persistence.interface';

/** An Active contract without movement for this long is stalled. */
export const STALLED_AFTER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The order in which blockers are shown: the first that applies is the
 * contract's main blocker. Draft sits with Suspended, as both are states of
 * the whole contract.
 */
export const DEPARTMENT_BLOCKER_RANK: readonly EDepartmentBlockerType[] = [
  EDepartmentBlockerType.SUSPENDED,
  EDepartmentBlockerType.DRAFT,
  EDepartmentBlockerType.PARTY_INVITATION_PENDING,
  EDepartmentBlockerType.ROLE_INVITATION_PENDING,
  EDepartmentBlockerType.SIGNATORY_MISSING,
  EDepartmentBlockerType.NO_WORKSPACE_ADMIN,
  EDepartmentBlockerType.NO_MEMBERS,
  EDepartmentBlockerType.STALLED,
];

export interface DepartmentBlockerInput {
  record: IDepartmentContractRecord;
  /** The overseeing company. */
  companyId: string;
  now: Date;
}

/** One rule: the blockers it finds on a contract, in any order. */
export type DepartmentBlockerRule = (
  input: DepartmentBlockerInput,
) => DepartmentBlocker[];

export function lastMovementAt(record: IDepartmentContractRecord): Date {
  const updated = record.contractUpdatedAt;
  const changed = record.lastStatusChangeAt;
  return changed && changed > updated ? changed : updated;
}

export function daysSince(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS));
}

function holder(
  input: DepartmentBlockerInput,
  companyId: string | null,
  companyName: string | null,
): DepartmentBlockerHolder {
  return {
    companyId,
    companyName,
    myCompany: companyId !== null && companyId === input.companyId,
  };
}

function myCompany(input: DepartmentBlockerInput): DepartmentBlockerHolder {
  const own = input.record.parties.find(
    ({ companyId }) => companyId === input.companyId,
  );
  return holder(input, input.companyId, own?.companyName ?? null);
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const suspended: DepartmentBlockerRule = (input) =>
  input.record.status === EContractStatus.SUSPENDED
    ? [
        {
          type: EDepartmentBlockerType.SUSPENDED,
          label: input.record.suspendedByCompanyName
            ? `Suspended by ${input.record.suspendedByCompanyName}`
            : 'Contract is suspended',
          holder: holder(
            input,
            input.record.suspendedByCompanyId,
            input.record.suspendedByCompanyName,
          ),
        },
      ]
    : [];

const draft: DepartmentBlockerRule = (input) =>
  input.record.status === EContractStatus.DRAFT
    ? [
        {
          type: EDepartmentBlockerType.DRAFT,
          label: 'Draft, not yet activated',
          holder: holder(
            input,
            input.record.ownerCompanyId,
            input.record.ownerCompanyName,
          ),
        },
      ]
    : [];

const partyInvitations: DepartmentBlockerRule = (input) =>
  input.record.pendingPartyInvitations.map((invitation) => ({
    type: EDepartmentBlockerType.PARTY_INVITATION_PENDING,
    label: `Invitation to ${invitation.companyName} is pending`,
    holder: holder(input, invitation.companyId, invitation.companyName),
  }));

const roleInvitations: DepartmentBlockerRule = (input) =>
  input.record.pendingRoleInvitationCount > 0
    ? [
        {
          type: EDepartmentBlockerType.ROLE_INVITATION_PENDING,
          label: `${plural(input.record.pendingRoleInvitationCount, 'role invitation')} awaiting acceptance`,
          holder: myCompany(input),
        },
      ]
    : [];

/** Signatories are recorded once a contract is executed, so not in Draft. */
const signatories: DepartmentBlockerRule = (input) =>
  input.record.status === EContractStatus.DRAFT
    ? []
    : input.record.parties
        .filter(({ signedAt }) => signedAt === null)
        .map((party) => ({
          type: EDepartmentBlockerType.SIGNATORY_MISSING,
          label: `${party.companyName} hasn’t recorded a signatory`,
          holder: holder(input, party.companyId, party.companyName),
        }));

/** Only for a staffed workspace: an empty one is reported as unstaffed. */
const noWorkspaceAdmin: DepartmentBlockerRule = (input) =>
  input.record.members.length > 0 &&
  !input.record.members.some(({ isWorkspaceAdmin }) => isWorkspaceAdmin)
    ? [
        {
          type: EDepartmentBlockerType.NO_WORKSPACE_ADMIN,
          label: 'No Workspace Admin from your company',
          holder: myCompany(input),
        },
      ]
    : [];

const noMembers: DepartmentBlockerRule = (input) =>
  input.record.members.length === 0
    ? [
        {
          type: EDepartmentBlockerType.NO_MEMBERS,
          label: 'Nobody from your company is assigned',
          holder: myCompany(input),
        },
      ]
    : [];

/**
 * Version 1 rules: only information a Company Administrator may already
 * see (contract, parties, status history, the company's own invitations and
 * role assignments).
 *
 * EXTENSION POINT (version 2, not built): rules from workspace content, such
 * as milestones awaiting approval, invoices awaiting certification, open
 * incidents or expiring compliance, would be added here only after the
 * product decision that a Company Administrator may see such aggregates.
 * Each needs its own data in IDepartmentContractRecord and a place in
 * DEPARTMENT_BLOCKER_RANK.
 */
export const DEPARTMENT_BLOCKER_RULES: readonly DepartmentBlockerRule[] = [
  suspended,
  draft,
  partyInvitations,
  roleInvitations,
  signatories,
  noWorkspaceAdmin,
  noMembers,
];

const rankOf = (type: EDepartmentBlockerType) =>
  DEPARTMENT_BLOCKER_RANK.indexOf(type);

/**
 * Every blocker on a contract, main blocker first. Archived and Completed
 * contracts have none. Stalled (an Active contract without movement for
 * STALLED_AFTER_DAYS) waits on whoever the other blockers name, else on an
 * unknown party.
 */
export function evaluateDepartmentBlockers(
  input: DepartmentBlockerInput,
  rules: readonly DepartmentBlockerRule[] = DEPARTMENT_BLOCKER_RULES,
): DepartmentBlocker[] {
  const { record, now } = input;
  if (record.archived || record.status === EContractStatus.COMPLETED) {
    return [];
  }
  const found = rules
    .flatMap((rule) => rule(input))
    .sort((a, b) => rankOf(a.type) - rankOf(b.type));
  const days = daysSince(lastMovementAt(record), now);
  if (record.status === EContractStatus.ACTIVE && days >= STALLED_AFTER_DAYS) {
    found.push({
      type: EDepartmentBlockerType.STALLED,
      label: `No movement for ${plural(days, 'day')}`,
      holder: found[0]?.holder ?? {
        companyId: null,
        companyName: null,
        myCompany: false,
      },
    });
  }
  return found;
}
