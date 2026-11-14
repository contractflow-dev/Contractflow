import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ECompanyRole, EContractorContractRole } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractAccessService } from './contract-access.service';
import { ContractResourceReader } from './contract-resource-reader';

describe('ContractAccessService', () => {
  const users = { findActiveMember: vi.fn() };
  const parties = { findByCompany: vi.fn() };
  const roleAssignments = { findActiveByCompanyUser: vi.fn() };
  const contracts = { findById: vi.fn(), findByIdIncludingArchived: vi.fn() };
  const workspaces = { exists: vi.fn() };
  let service: ContractAccessService;

  beforeEach(() => {
    vi.resetAllMocks();
    users.findActiveMember.mockResolvedValue({
      id: 'm1',
      companyRole: ECompanyRole.MEMBER,
    });
    parties.findByCompany.mockResolvedValue({ id: 'p1' });
    roleAssignments.findActiveByCompanyUser.mockResolvedValue([
      {
        contractPartyId: 'p1',
        role: EContractorContractRole.FINANCE_OFFICER,
      },
    ]);
    contracts.findById.mockResolvedValue({ id: 'c1' });
    workspaces.exists.mockResolvedValue(true);
    service = new ContractAccessService(
      users as never,
      parties as never,
      roleAssignments as never,
      contracts as never,
      workspaces as never,
    );
  });

  it('returns a trusted scope for a permitted finance member', async () => {
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).resolves.toEqual({ contractId: 'c1', companyId: 'co1' });
    expect(users.findActiveMember).toHaveBeenCalledWith(
      { companyId: 'co1' },
      'u1',
    );
    expect(parties.findByCompany).toHaveBeenCalledWith(
      { contractId: 'c1', companyId: 'co1' },
      'co1',
    );
    expect(roleAssignments.findActiveByCompanyUser).toHaveBeenCalledWith('m1', {
      companyId: 'co1',
    });
    expect(contracts.findById).toHaveBeenCalledWith(
      {
        companyId: 'co1',
        companyUserId: 'm1',
        includeCompanyAdminOversight: false,
      },
      'c1',
    );
    expect(workspaces.exists).toHaveBeenCalledWith(
      { contractId: 'c1', companyId: 'co1' },
      'finance',
    );
  });

  it('rejects non-members before touching contract data', async () => {
    users.findActiveMember.mockResolvedValue(null);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(parties.findByCompany).not.toHaveBeenCalled();
    expect(roleAssignments.findActiveByCompanyUser).not.toHaveBeenCalled();
  });

  it('hides contracts the company is not a party to', async () => {
    parties.findByCompany.mockResolvedValue(null);
    await expect(
      service.authorize('u1', 'co1', 'other', 'finance'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps workspace roles separate', async () => {
    await expect(
      service.authorize('u1', 'co1', 'c1', 'project'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'general'),
    ).resolves.toBeDefined();

    roleAssignments.findActiveByCompanyUser.mockResolvedValue([
      {
        contractPartyId: 'p1',
        role: EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      },
    ]);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'project'),
    ).resolves.toBeDefined();
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not grant workspace or protected-resource access from Company Administrator membership alone', async () => {
    users.findActiveMember.mockResolvedValue({
      id: 'm1',
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });
    roleAssignments.findActiveByCompanyUser.mockResolvedValue([]);
    // The contract is visible to them through oversight, so 403 (not 404).
    for (const workspace of ['general', 'project', 'hse', 'finance'] as const) {
      await expect(
        service.authorize('u1', 'co1', 'c1', workspace),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    contracts.findByIdIncludingArchived.mockResolvedValue({
      id: 'c1',
      deletedAt: null,
    });
    await expect(
      service.authorizeIncludingArchived('u1', 'co1', 'c1', 'general'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(contracts.findById).toHaveBeenCalledWith(
      {
        companyId: 'co1',
        companyUserId: 'm1',
        includeCompanyAdminOversight: true,
      },
      'c1',
    );
  });

  it('hides the contract (404) from a member with no role, a revoked role or a role on another party', async () => {
    roleAssignments.findActiveByCompanyUser.mockResolvedValue([]);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(NotFoundException);

    roleAssignments.findActiveByCompanyUser.mockResolvedValue([
      {
        contractPartyId: 'other-party',
        role: EContractorContractRole.FINANCE_OFFICER,
      },
    ]);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(contracts.findById).not.toHaveBeenCalled();
  });

  it('answers 404 when the SQL visibility re-check finds nothing', async () => {
    contracts.findById.mockResolvedValue(null);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps archived contracts out of the default check', async () => {
    // findById excludes archived contracts, so authorize reports not found.
    contracts.findById.mockResolvedValue(null);
    contracts.findByIdIncludingArchived.mockResolvedValue({
      id: 'c1',
      deletedAt: new Date(),
    });
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(contracts.findByIdIncludingArchived).not.toHaveBeenCalled();
  });

  it('reports an archived contract to callers that keep it read-only', async () => {
    contracts.findByIdIncludingArchived.mockResolvedValue({
      id: 'c1',
      deletedAt: new Date(),
    });
    await expect(
      service.authorizeIncludingArchived('u1', 'co1', 'c1', 'finance'),
    ).resolves.toEqual({
      scope: { contractId: 'c1', companyId: 'co1' },
      archived: true,
    });

    contracts.findByIdIncludingArchived.mockResolvedValue({
      id: 'c1',
      deletedAt: null,
    });
    await expect(
      service.authorizeIncludingArchived('u1', 'co1', 'c1', 'finance'),
    ).resolves.toMatchObject({ archived: false });
  });

  it('applies the same role checks to archived contracts', async () => {
    contracts.findByIdIncludingArchived.mockResolvedValue({
      id: 'c1',
      deletedAt: new Date(),
    });
    roleAssignments.findActiveByCompanyUser.mockResolvedValue([]);
    await expect(
      service.authorizeIncludingArchived('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(NotFoundException);

    roleAssignments.findActiveByCompanyUser.mockResolvedValue([
      {
        contractPartyId: 'p1',
        role: EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      },
    ]);
    await expect(
      service.authorizeIncludingArchived('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('authorizeContractOversight', () => {
    it('lets a member with an active role see the contract, on the assignment basis', async () => {
      await expect(
        service.authorizeContractOversight('u1', 'co1', 'c1'),
      ).resolves.toEqual({
        scope: { contractId: 'c1', companyId: 'co1' },
        basis: 'assignment',
        party: { id: 'p1' },
        contract: { id: 'c1' },
        isCompanyAdmin: false,
      });
      expect(contracts.findById).toHaveBeenCalledWith(
        {
          companyId: 'co1',
          companyUserId: 'm1',
          includeCompanyAdminOversight: true,
        },
        'c1',
      );
      expect(workspaces.exists).not.toHaveBeenCalled();
    });

    it('lets a Company Administrator without a role see the contract, on the oversight basis', async () => {
      users.findActiveMember.mockResolvedValue({
        id: 'm1',
        companyRole: ECompanyRole.COMPANY_ADMIN,
      });
      roleAssignments.findActiveByCompanyUser.mockResolvedValue([]);
      await expect(
        service.authorizeContractOversight('u1', 'co1', 'c1'),
      ).resolves.toMatchObject({ basis: 'company_admin_oversight' });
    });

    it('hides the contract from an ordinary member without a role on this party', async () => {
      roleAssignments.findActiveByCompanyUser.mockResolvedValue([
        {
          contractPartyId: 'other-party',
          role: EContractorContractRole.FINANCE_OFFICER,
        },
      ]);
      await expect(
        service.authorizeContractOversight('u1', 'co1', 'c1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(contracts.findById).not.toHaveBeenCalled();
    });

    it('hides non-party and archived contracts, and refuses non-members', async () => {
      parties.findByCompany.mockResolvedValueOnce(null);
      await expect(
        service.authorizeContractOversight('u1', 'co1', 'c1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      contracts.findById.mockResolvedValueOnce(null);
      await expect(
        service.authorizeContractOversight('u1', 'co1', 'c1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      users.findActiveMember.mockResolvedValueOnce(null);
      await expect(
        service.authorizeContractOversight('u1', 'co1', 'c1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('rejects blank identifiers', async () => {
    await expect(
      service.authorize('u1', ' ', 'c1', 'general'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.authorize('u1', 'co1', '', 'general'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
describe('ContractResourceReader', () => {
  const access = { authorize: vi.fn() };
  const repository = { findPage: vi.fn(), findById: vi.fn() };
  let reader: ContractResourceReader<{ id: string; contractId: string }>;

  beforeEach(() => {
    vi.resetAllMocks();
    access.authorize.mockResolvedValue({ contractId: 'c1', companyId: 'co1' });
    reader = new ContractResourceReader(
      access as never,
      repository as never,
      'finance',
      'Invoice',
    );
  });

  it('lists only through the authorized scope with paging and stable order', async () => {
    repository.findPage.mockResolvedValue({ items: [{ id: 'i1' }], total: 1 });

    const result = await reader.list('u1', 'co1', 'c1', { page: 3, limit: 10 });

    expect(access.authorize).toHaveBeenCalledWith('u1', 'co1', 'c1', 'finance');
    expect(repository.findPage).toHaveBeenCalledWith(
      { contractId: 'c1', companyId: 'co1' },
      { order: { createdAt: 'DESC', id: 'ASC' }, skip: 20, take: 10 },
    );
    expect(result).toEqual({
      data: [{ id: 'i1' }],
      meta: {
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 3,
      },
    });
  });

  it('returns not found for records outside the scope', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      reader.get('u1', 'co1', 'c1', 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never queries when authorization fails', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());

    await expect(
      reader.list('u1', 'co1', 'c1', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(reader.get('u1', 'co1', 'c1', 'i1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.findPage).not.toHaveBeenCalled();
    expect(repository.findById).not.toHaveBeenCalled();
  });
});
