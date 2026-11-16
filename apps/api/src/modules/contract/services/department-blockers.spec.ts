import {
  EContractStatus,
  EDepartmentBlockerType,
  EPartyType,
} from '@contractflow/contracts-schema';
import { describe, expect, it } from 'vitest';
import type { IDepartmentContractRecord } from '../interfaces/company-department-persistence.interface';
import {
  DEPARTMENT_BLOCKER_RANK,
  STALLED_AFTER_DAYS,
  daysSince,
  evaluateDepartmentBlockers,
  lastMovementAt,
} from './department-blockers';

const ME = 'company-me';
const NOW = new Date('2026-11-14T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

/** A healthy Active contract: signed, staffed, with an admin, recently moved. */
function record(
  overrides: Partial<IDepartmentContractRecord> = {},
): IDepartmentContractRecord {
  return {
    contractId: 'c1',
    referenceNumber: 'CF-1',
    title: 'Pipeline',
    status: EContractStatus.ACTIVE,
    archived: false,
    ownerCompanyId: 'company-client',
    ownerCompanyName: 'Client Ltd',
    partyType: EPartyType.CONTRACTOR,
    contractUpdatedAt: daysAgo(2),
    lastStatusChangeAt: daysAgo(3),
    suspendedByCompanyId: null,
    suspendedByCompanyName: null,
    parties: [
      {
        companyId: 'company-client',
        companyName: 'Client Ltd',
        partyType: EPartyType.CLIENT,
        signedAt: daysAgo(30),
      },
      {
        companyId: ME,
        companyName: 'My Works',
        partyType: EPartyType.CONTRACTOR,
        signedAt: daysAgo(30),
      },
    ],
    pendingPartyInvitations: [],
    members: [
      {
        companyUserId: 'm1',
        firstName: 'Ada',
        lastName: 'Lead',
        isWorkspaceAdmin: true,
      },
    ],
    pendingRoleInvitationCount: 0,
    requesterHasRole: false,
    ...overrides,
  };
}

const evaluate = (overrides: Partial<IDepartmentContractRecord> = {}) =>
  evaluateDepartmentBlockers({
    record: record(overrides),
    companyId: ME,
    now: NOW,
  });
const types = (overrides: Partial<IDepartmentContractRecord> = {}) =>
  evaluate(overrides).map(({ type }) => type);

describe('department blockers', () => {
  it('finds nothing on a healthy contract', () => {
    expect(evaluate()).toEqual([]);
  });

  it('holds a suspended contract on the company that suspended it', () => {
    const [blocker] = evaluate({
      status: EContractStatus.SUSPENDED,
      suspendedByCompanyId: 'company-client',
      suspendedByCompanyName: 'Client Ltd',
    });
    expect(blocker).toEqual({
      type: EDepartmentBlockerType.SUSPENDED,
      label: 'Suspended by Client Ltd',
      holder: {
        companyId: 'company-client',
        companyName: 'Client Ltd',
        myCompany: false,
      },
    });
  });

  it('flags my company when it suspended the contract, and Unknown when nobody is recorded', () => {
    expect(
      evaluate({
        status: EContractStatus.SUSPENDED,
        suspendedByCompanyId: ME,
        suspendedByCompanyName: 'My Works',
      })[0].holder.myCompany,
    ).toBe(true);
    expect(evaluate({ status: EContractStatus.SUSPENDED })[0]).toMatchObject({
      label: 'Contract is suspended',
      holder: { companyId: null, companyName: null, myCompany: false },
    });
  });

  it('holds a draft on its owner company, without asking for signatories yet', () => {
    const blockers = evaluate({
      status: EContractStatus.DRAFT,
      parties: record().parties.map((p) => ({ ...p, signedAt: null })),
    });
    expect(blockers).toEqual([
      {
        type: EDepartmentBlockerType.DRAFT,
        label: 'Draft, not yet activated',
        holder: {
          companyId: 'company-client',
          companyName: 'Client Ltd',
          myCompany: false,
        },
      },
    ]);
  });

  it('holds a pending company invitation on the invited company', () => {
    expect(
      evaluate({
        pendingPartyInvitations: [
          { companyId: 'company-sub', companyName: 'Sub Ltd' },
        ],
      }),
    ).toEqual([
      {
        type: EDepartmentBlockerType.PARTY_INVITATION_PENDING,
        label: 'Invitation to Sub Ltd is pending',
        holder: {
          companyId: 'company-sub',
          companyName: 'Sub Ltd',
          myCompany: false,
        },
      },
    ]);
  });

  it('holds pending role invitations on my company', () => {
    expect(evaluate({ pendingRoleInvitationCount: 2 })).toEqual([
      {
        type: EDepartmentBlockerType.ROLE_INVITATION_PENDING,
        label: '2 role invitations awaiting acceptance',
        holder: { companyId: ME, companyName: 'My Works', myCompany: true },
      },
    ]);
  });

  it('holds a missing signatory on that party', () => {
    const blockers = evaluate({
      parties: [
        { ...record().parties[0], signedAt: null },
        record().parties[1],
      ],
    });
    expect(blockers).toEqual([
      {
        type: EDepartmentBlockerType.SIGNATORY_MISSING,
        label: 'Client Ltd hasn’t recorded a signatory',
        holder: {
          companyId: 'company-client',
          companyName: 'Client Ltd',
          myCompany: false,
        },
      },
    ]);
  });

  it('holds a staffed workspace without an admin on my company', () => {
    expect(
      evaluate({
        members: [{ ...record().members[0], isWorkspaceAdmin: false }],
      }),
    ).toEqual([
      {
        type: EDepartmentBlockerType.NO_WORKSPACE_ADMIN,
        label: 'No Workspace Admin from your company',
        holder: { companyId: ME, companyName: 'My Works', myCompany: true },
      },
    ]);
  });

  it('reports an empty workspace as unstaffed, not also as lacking an admin', () => {
    expect(evaluate({ members: [] })).toEqual([
      {
        type: EDepartmentBlockerType.NO_MEMBERS,
        label: 'Nobody from your company is assigned',
        holder: { companyId: ME, companyName: 'My Works', myCompany: true },
      },
    ]);
  });

  describe('stalled', () => {
    const quiet = {
      contractUpdatedAt: daysAgo(20),
      lastStatusChangeAt: daysAgo(STALLED_AFTER_DAYS),
    };

    it('marks an Active contract without movement for 14 days, held by Unknown alone', () => {
      expect(evaluate(quiet)).toEqual([
        {
          type: EDepartmentBlockerType.STALLED,
          label: 'No movement for 14 days',
          holder: { companyId: null, companyName: null, myCompany: false },
        },
      ]);
      // 13 days is not stalled yet.
      expect(
        types({
          contractUpdatedAt: daysAgo(13),
          lastStatusChangeAt: daysAgo(20),
        }),
      ).toEqual([]);
    });

    it('waits on the party the other blockers name', () => {
      const blockers = evaluate({ ...quiet, members: [] });
      expect(blockers.map(({ type }) => type)).toEqual([
        EDepartmentBlockerType.NO_MEMBERS,
        EDepartmentBlockerType.STALLED,
      ]);
      expect(blockers[1].holder.myCompany).toBe(true);
    });

    it('is only for Active contracts', () => {
      expect(
        types({ ...quiet, status: EContractStatus.SUSPENDED }),
      ).not.toContain(EDepartmentBlockerType.STALLED);
      expect(types({ ...quiet, status: EContractStatus.DRAFT })).not.toContain(
        EDepartmentBlockerType.STALLED,
      );
    });
  });

  it('ranks Suspended, invitation, signatory, no admin, no members, stalled', () => {
    const all = evaluate({
      status: EContractStatus.SUSPENDED,
      suspendedByCompanyId: 'company-client',
      suspendedByCompanyName: 'Client Ltd',
      pendingPartyInvitations: [{ companyId: 'x', companyName: 'X Ltd' }],
      pendingRoleInvitationCount: 1,
      parties: [{ ...record().parties[0], signedAt: null }],
      members: [],
    });
    expect(all.map(({ type }) => type)).toEqual([
      EDepartmentBlockerType.SUSPENDED,
      EDepartmentBlockerType.PARTY_INVITATION_PENDING,
      EDepartmentBlockerType.ROLE_INVITATION_PENDING,
      EDepartmentBlockerType.SIGNATORY_MISSING,
      EDepartmentBlockerType.NO_MEMBERS,
    ]);
    expect(DEPARTMENT_BLOCKER_RANK.at(-1)).toBe(EDepartmentBlockerType.STALLED);
  });

  it('finds nothing on archived or completed contracts', () => {
    const troubled = {
      members: [],
      pendingRoleInvitationCount: 3,
      contractUpdatedAt: daysAgo(90),
      lastStatusChangeAt: daysAgo(90),
    };
    expect(evaluate({ ...troubled, archived: true })).toEqual([]);
    expect(
      evaluate({ ...troubled, status: EContractStatus.COMPLETED }),
    ).toEqual([]);
  });

  it('accepts more rules at the extension point', () => {
    const extra = () => [
      {
        type: EDepartmentBlockerType.NO_MEMBERS,
        label: 'Extra',
        holder: { companyId: null, companyName: null, myCompany: false },
      },
    ];
    expect(
      evaluateDepartmentBlockers(
        { record: record(), companyId: ME, now: NOW },
        [extra],
      ).map(({ label }) => label),
    ).toEqual(['Extra']);
  });

  it('takes the latest of the last status change and the last edit as movement', () => {
    expect(
      lastMovementAt(
        record({
          contractUpdatedAt: daysAgo(5),
          lastStatusChangeAt: daysAgo(1),
        }),
      ),
    ).toEqual(daysAgo(1));
    expect(
      lastMovementAt(
        record({ contractUpdatedAt: daysAgo(5), lastStatusChangeAt: null }),
      ),
    ).toEqual(daysAgo(5));
    expect(daysSince(daysAgo(3.5), NOW)).toBe(3);
  });
});
