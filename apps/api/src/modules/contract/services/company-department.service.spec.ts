import { ForbiddenException } from '@nestjs/common';
import {
  ECompanyDepartment,
  EContractStatus,
  EDepartmentContractSort,
  EPartyType,
} from '@contractflow/contracts-schema';
import { describe, expect, it, vi } from 'vitest';
import type {
  ICompanyDepartmentPersistence,
  IDepartmentContractRecord,
} from '../interfaces/company-department-persistence.interface';
import { CompanyDepartmentService } from './company-department.service';
import type { ContractAccessService } from './contract-access.service';
import { WORKSPACE_ROLES } from './contract-workspace';

const ME = 'company-me';
const NOW = new Date('2026-11-14T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

let sequence = 0;
function contract(
  overrides: Partial<IDepartmentContractRecord> = {},
): IDepartmentContractRecord {
  sequence += 1;
  return {
    contractId: `c${sequence}`,
    referenceNumber: `CF-${String(sequence).padStart(2, '0')}`,
    title: `Contract ${sequence}`,
    status: EContractStatus.ACTIVE,
    archived: false,
    ownerCompanyId: ME,
    ownerCompanyName: 'My Works',
    partyType: EPartyType.CLIENT,
    contractUpdatedAt: daysAgo(1),
    lastStatusChangeAt: daysAgo(1),
    suspendedByCompanyId: null,
    suspendedByCompanyName: null,
    parties: [
      {
        companyId: ME,
        companyName: 'My Works',
        partyType: EPartyType.CLIENT,
        signedAt: daysAgo(10),
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

function setup(records: IDepartmentContractRecord[]) {
  const access = {
    authorizeCompanyOversight: vi
      .fn()
      .mockResolvedValue({ companyId: ME, companyUserId: 'admin-1' }),
  };
  const persistence = {
    listContracts: vi.fn().mockResolvedValue(records),
  } satisfies ICompanyDepartmentPersistence;
  const service = new CompanyDepartmentService(
    access as unknown as ContractAccessService,
    persistence,
  );
  const list = (query: Record<string, unknown> = {}) =>
    service.listContracts(
      'user-1',
      ME,
      ECompanyDepartment.HSE,
      { page: 1, limit: 10, ...query },
      NOW,
    );
  return { access, persistence, list };
}

/** One contract per situation the table distinguishes. */
function portfolio() {
  sequence = 0;
  return {
    healthy: contract({ title: 'Healthy' }),
    unstaffed: contract({
      title: 'Unstaffed',
      members: [],
      contractUpdatedAt: daysAgo(30),
      lastStatusChangeAt: daysAgo(30),
    }),
    unstaffedRecent: contract({ title: 'Unstaffed recent', members: [] }),
    awaitingOther: contract({
      title: 'Awaiting Sub',
      partyType: EPartyType.CONTRACTOR,
      pendingPartyInvitations: [
        { companyId: 'company-sub', companyName: 'Sub Ltd' },
      ],
      members: [
        {
          companyUserId: 'm2',
          firstName: 'Bo',
          lastName: 'Officer',
          isWorkspaceAdmin: true,
        },
        {
          companyUserId: 'm1',
          firstName: 'Ada',
          lastName: 'Lead',
          isWorkspaceAdmin: false,
        },
      ],
    }),
    draft: contract({
      title: 'Draft one',
      status: EContractStatus.DRAFT,
      ownerCompanyId: 'company-client',
      ownerCompanyName: 'Client Ltd',
    }),
    archived: contract({ title: 'Old one', archived: true, members: [] }),
  };
}

describe('CompanyDepartmentService', () => {
  it('checks Company Administrator oversight before reading anything', async () => {
    const { access, persistence, list } = setup([]);
    access.authorizeCompanyOversight.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(list()).rejects.toBeInstanceOf(ForbiddenException);
    expect(persistence.listContracts).not.toHaveBeenCalled();
  });

  it("reads through the oversight scope with the workspace's roles", async () => {
    const { access, persistence, list } = setup([]);

    await list({ includeArchived: true });

    expect(access.authorizeCompanyOversight).toHaveBeenCalledWith('user-1', ME);
    expect(persistence.listContracts).toHaveBeenCalledWith(
      { companyId: ME, companyUserId: 'admin-1' },
      'hse',
      WORKSPACE_ROLES.hse,
      { includeArchived: true, now: NOW },
    );
  });

  it('builds each row: party type, members, admins, blocker, movement', async () => {
    const { awaitingOther } = portfolio();
    const { list } = setup([awaitingOther]);

    const [row] = (await list()).data;

    expect(row).toMatchObject({
      partyType: EPartyType.CONTRACTOR,
      memberCount: 2,
      otherBlockerCount: 0,
      daysSinceMovement: 1,
      hasWorkspaceRole: false,
      primaryBlocker: {
        holder: { companyName: 'Sub Ltd', myCompany: false },
      },
    });
    // Workspace Admins first.
    expect(row.members.map(({ companyUserId }) => companyUserId)).toEqual([
      'm2',
      'm1',
    ]);
    expect(row.workspaceAdmins).toEqual([
      { companyUserId: 'm2', firstName: 'Bo', lastName: 'Officer' },
    ]);
  });

  it('summarizes the contracts that are not archived', async () => {
    const all = portfolio();
    const { list } = setup(Object.values(all));

    const { summary } = await list();

    expect(summary).toEqual({
      contractCount: 5,
      memberCount: 2, // m1 and m2, counted once each
      waitingOnMyCompanyCount: 2, // the two unstaffed contracts
      waitingOnOtherCompaniesCount: 2, // the invitation, and the client's draft
    });
  });

  it('puts contracts waiting on my company first, then the longest stalled', async () => {
    const all = portfolio();
    const { list } = setup(Object.values(all));

    const titles = (await list()).data.map(({ title }) => title);

    expect(titles.slice(0, 2)).toEqual(['Unstaffed', 'Unstaffed recent']);
  });

  it('filters by search, status, party type and whose move it is', async () => {
    const all = portfolio();
    const { list } = setup(Object.values(all));
    const titles = async (query: Record<string, unknown>) =>
      (await list(query)).data.map(({ title }) => title).sort();

    expect(await titles({ search: 'draft' })).toEqual(['Draft one']);
    expect(await titles({ search: 'cf-02' })).toEqual(['Unstaffed']);
    expect(await titles({ status: EContractStatus.DRAFT })).toEqual([
      'Draft one',
    ]);
    expect(await titles({ partyType: EPartyType.CONTRACTOR })).toEqual([
      'Awaiting Sub',
    ]);
    expect(await titles({ waitingOn: 'us' })).toEqual([
      'Unstaffed',
      'Unstaffed recent',
    ]);
    expect(await titles({ waitingOn: 'others' })).toEqual([
      'Awaiting Sub',
      'Draft one',
    ]);
  });

  it('sorts by reference, title or longest stalled on request', async () => {
    const all = portfolio();
    const { list } = setup(Object.values(all));
    const order = async (sort: EDepartmentContractSort) =>
      (await list({ sort })).data.map(({ title }) => title);

    expect((await order(EDepartmentContractSort.REFERENCE))[0]).toBe('Healthy');
    expect((await order(EDepartmentContractSort.TITLE))[0]).toBe(
      'Awaiting Sub',
    );
    expect((await order(EDepartmentContractSort.LONGEST_STALLED))[0]).toBe(
      'Unstaffed',
    );
  });

  it('pages after filtering and ordering', async () => {
    const all = portfolio();
    const { list } = setup(Object.values(all));

    const first = await list({
      limit: 2,
      sort: EDepartmentContractSort.REFERENCE,
    });
    const third = await list({
      limit: 2,
      page: 3,
      sort: EDepartmentContractSort.REFERENCE,
    });

    expect(first.meta).toMatchObject({
      totalItems: 6,
      itemCount: 2,
      totalPages: 3,
      currentPage: 1,
    });
    expect(first.data.map(({ referenceNumber }) => referenceNumber)).toEqual([
      'CF-01',
      'CF-02',
    ]);
    expect(third.data.map(({ referenceNumber }) => referenceNumber)).toEqual([
      'CF-05',
      'CF-06',
    ]);
  });

  it('lists archived contracts read-only, without blockers', async () => {
    const { archived } = portfolio();
    const { list } = setup([archived]);

    const [row] = (await list({ includeArchived: true })).data;

    expect(row).toMatchObject({ archived: true, primaryBlocker: null });
  });
});
