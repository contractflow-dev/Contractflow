import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ECompanyRole,
  EContractSortField,
  ESortOrder,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractService } from './contract.service';

describe('ContractService', () => {
  const contractRecord = {
    id: 'c-1',
    referenceNumber: 'CTR-001',
    title: 'Bridge works',
    description: null,
    contractType: 'service',
    status: 'draft',
    parentContractId: null,
    originalValueMinor: 125000,
    currentValueMinor: 125000,
    currencyCode: 'NGN',
    retentionRateBps: 500,
    advancePaymentRateBps: null,
    paymentTermsDays: 30,
    liquidatedDamagesPerDayMinor: null,
    awardDate: new Date('2026-01-01T00:00:00.000Z'),
    startDate: new Date('2026-01-02T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    revisedEndDate: null,
    actualCompletionDate: null,
    defectsLiabilityDays: 365,
    timezone: 'Africa/Lagos',
    createdAt: new Date('2025-12-01T12:00:00.000Z'),
    updatedAt: new Date('2025-12-02T12:00:00.000Z'),
    deletedAt: null,
    createdByCompanyId: 'co-1',
    deletedByCompanyUserId: null,
  };
  const scopeFor = { forUser: vi.fn(), contextForUser: vi.fn() };
  const roleAssignments = { findActiveRolesForContracts: vi.fn() };
  const parties = {
    findByCompany: vi.fn(),
    findAllWithCompany: vi.fn(),
    findCounterparties: vi.fn(),
  };
  const history = { searchPage: vi.fn() };
  const contracts = { findById: vi.fn(), searchPage: vi.fn() };
  const companyUsers = { findActiveRoleForUser: vi.fn() };
  const workspaces = { findWorkspaces: vi.fn() };
  const access = { authorizeContractOversight: vi.fn() };
  const party = {
    id: 'p-1',
    companyId: 'co-1',
    partyType: 'contractor',
    signedAt: null,
    signatoryFirstName: 'Private',
    signatoryLastName: 'Signatory',
  };
  let service: ContractService;

  beforeEach(() => {
    vi.resetAllMocks();
    scopeFor.forUser.mockResolvedValue({ companyId: 'co-1' });
    scopeFor.contextForUser.mockResolvedValue({
      companyId: 'co-1',
      membership: { id: 'cu-1', companyId: 'co-1' },
    });
    roleAssignments.findActiveRolesForContracts.mockResolvedValue([]);
    parties.findByCompany.mockResolvedValue({
      id: 'p-1',
      companyId: 'co-1',
      partyType: 'contractor',
      signedAt: null,
      signatoryFirstName: 'Private',
      signatoryLastName: 'Signatory',
    });
    parties.findAllWithCompany.mockResolvedValue([]);
    parties.findCounterparties.mockResolvedValue([]);
    history.searchPage.mockResolvedValue({ items: [], total: 0 });
    contracts.findById.mockResolvedValue(contractRecord);
    companyUsers.findActiveRoleForUser.mockResolvedValue(
      ECompanyRole.COMPANY_ADMIN,
    );
    workspaces.findWorkspaces.mockResolvedValue(['general', 'finance']);
    access.authorizeContractOversight.mockResolvedValue({
      scope: { contractId: 'c-1', companyId: 'co-1' },
      basis: 'assignment',
      party,
      contract: contractRecord,
    });
    service = new ContractService(
      scopeFor as never,
      parties as never,
      history as never,
      contracts as never,
      companyUsers as never,
      workspaces as never,
      roleAssignments as never,
      access as never,
    );
  });

  it('rejects users who are not active members of the company', async () => {
    scopeFor.forUser.mockRejectedValue(new ForbiddenException());
    scopeFor.contextForUser.mockRejectedValue(new ForbiddenException());
    access.authorizeContractOversight.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(service.get('u', 'co-1', 'c-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.list('u', 'co-1', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(contracts.findById).not.toHaveBeenCalled();
    expect(contracts.searchPage).not.toHaveBeenCalled();
  });

  it('hides contracts the caller may not see (no role, not a party, archived)', async () => {
    access.authorizeContractOversight.mockRejectedValue(
      new NotFoundException(),
    );

    await expect(service.get('u', 'co-1', 'c-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.listStatusHistory('u', 'co-1', 'c-9', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.listParties('u', 'co-1', 'c-9'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.listWorkspaces('u', 'co-1', 'c-9'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(history.searchPage).not.toHaveBeenCalled();
    expect(parties.findAllWithCompany).not.toHaveBeenCalled();
    expect(workspaces.findWorkspaces).not.toHaveBeenCalled();
  });

  it('serves detail, parties, history and workspaces under Company Administrator oversight', async () => {
    access.authorizeContractOversight.mockResolvedValue({
      scope: { contractId: 'c-1', companyId: 'co-1' },
      basis: 'company_admin_oversight',
      party,
      contract: contractRecord,
    });

    await expect(service.get('u', 'co-1', 'c-1')).resolves.toMatchObject({
      contract: { id: 'c-1' },
    });
    await service.listParties('u', 'co-1', 'c-1');
    await service.listStatusHistory('u', 'co-1', 'c-1', { page: 1, limit: 10 });
    await service.listWorkspaces('u', 'co-1', 'c-1');
    expect(access.authorizeContractOversight).toHaveBeenCalledTimes(4);
    for (const call of access.authorizeContractOversight.mock.calls) {
      expect(call).toEqual(['u', 'co-1', 'c-1']);
    }
  });

  it('returns a contract the caller may see', async () => {
    const result = await service.get('u', 'co-1', 'c-1');
    expect(result.contract).toMatchObject({
      id: 'c-1',
      referenceNumber: 'CTR-001',
      title: 'Bridge works',
      awardDate: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    });
    expect(Object.keys(result.contract)).not.toContain('createdByCompanyId');
    expect(Object.keys(result.contract)).not.toContain(
      'deletedByCompanyUserId',
    );
    expect(result.membership).toEqual({
      id: 'p-1',
      companyId: 'co-1',
      partyType: 'contractor',
      signedAt: null,
    });
    expect(access.authorizeContractOversight).toHaveBeenCalledWith(
      'u',
      'co-1',
      'c-1',
    );
  });

  it('hides archived contracts from party, history, and detail reads', async () => {
    // The oversight check loads only non-archived contracts.
    access.authorizeContractOversight.mockRejectedValue(
      new NotFoundException(),
    );

    await expect(service.get('u', 'co-1', 'c-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.listParties('u', 'co-1', 'c-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.listStatusHistory('u', 'co-1', 'c-1', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(parties.findAllWithCompany).not.toHaveBeenCalled();
    expect(history.searchPage).not.toHaveBeenCalled();
  });

  it('exposes only minimal counterparty details', async () => {
    parties.findAllWithCompany.mockResolvedValue([
      {
        id: 'p-2',
        companyId: 'co-2',
        partyType: 'contractor',
        signedAt: new Date(0),
        signatoryFirstName: 'Secret',
        company: { name: 'Builder Ltd', taxIdentificationNumber: 'TAX' },
      },
    ]);

    const result = await service.listParties('u', 'co-1', 'c-1');

    expect(result).toEqual([
      {
        id: 'p-2',
        companyId: 'co-2',
        companyName: 'Builder Ltd',
        partyType: 'contractor',
        signedAt: new Date(0),
      },
    ]);
    expect(parties.findAllWithCompany).toHaveBeenCalledWith({
      contractId: 'c-1',
      companyId: 'co-1',
    });
  });

  it('scopes status history to the contract and the verified company', async () => {
    await service.listStatusHistory('u', 'co-1', 'c-1', { page: 3, limit: 10 });

    expect(history.searchPage).toHaveBeenCalledWith(
      { contractId: 'c-1', companyId: 'co-1' },
      { skip: 20, take: 10 },
    );
  });

  it('lists through the repository using the verified company scope and paging', async () => {
    contracts.searchPage.mockResolvedValue({ items: [], total: 0 });

    const result = await service.list('u', 'co-1', {
      search: 'bridge',
      page: 2,
      limit: 5,
    });

    expect(contracts.searchPage).toHaveBeenCalledWith(
      {
        companyId: 'co-1',
        companyUserId: 'cu-1',
        includeCompanyAdminOversight: true,
      },
      { search: 'bridge', status: undefined, skip: 5, take: 5 },
    );
    expect(result).toEqual({
      data: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 5,
        totalPages: 0,
        currentPage: 2,
      },
    });
  });

  it('passes validated sort options to the scoped search', async () => {
    contracts.searchPage.mockResolvedValue({ items: [], total: 0 });

    await service.list('u', 'co-1', {
      page: 1,
      limit: 20,
      sortBy: EContractSortField.TITLE,
      sortOrder: ESortOrder.ASC,
    });

    expect(contracts.searchPage).toHaveBeenCalledWith(
      {
        companyId: 'co-1',
        companyUserId: 'cu-1',
        includeCompanyAdminOversight: true,
      },
      expect.objectContaining({
        sortBy: EContractSortField.TITLE,
        sortOrder: ESortOrder.ASC,
        skip: 0,
        take: 20,
      }),
    );
  });

  it('requires an active company administrator before listing archived contracts', async () => {
    companyUsers.findActiveRoleForUser.mockResolvedValueOnce(null);

    await expect(
      service.list('u', 'co-1', {
        page: 1,
        limit: 10,
        includeDeleted: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(contracts.searchPage).not.toHaveBeenCalled();

    contracts.searchPage.mockResolvedValue({ items: [], total: 0 });
    await service.list('u', 'co-1', {
      page: 1,
      limit: 10,
      includeDeleted: true,
    });
    expect(contracts.searchPage).toHaveBeenCalledWith(
      {
        companyId: 'co-1',
        companyUserId: 'cu-1',
        includeCompanyAdminOversight: true,
      },
      {
        search: undefined,
        status: undefined,
        includeDeleted: true,
        creatorCompanyId: 'co-1',
        skip: 0,
        take: 10,
      },
    );
  });

  it('lists workspaces only through the authorized contract scope', async () => {
    await expect(service.listWorkspaces('u', 'co-1', 'c-1')).resolves.toEqual([
      'general',
      'finance',
    ]);
    expect(workspaces.findWorkspaces).toHaveBeenCalledWith({
      contractId: 'c-1',
      companyId: 'co-1',
    });
  });

  it('projects listed contracts to the shared response contract', async () => {
    contracts.searchPage.mockResolvedValue({
      items: [contractRecord],
      total: 1,
    });

    const result = await service.list('u', 'co-1', {
      page: 1,
      limit: 10,
    });

    expect(result.data[0]).toMatchObject({
      id: 'c-1',
      title: 'Bridge works',
      createdAt: '2025-12-01T12:00:00.000Z',
    });
    expect(Object.keys(result.data[0])).not.toContain('createdByCompanyId');
    expect(Object.keys(result.data[0])).not.toContain(
      'deletedByCompanyUserId',
    );
  });

  it('adds the other parties to each listed contract with one scoped query', async () => {
    contracts.searchPage.mockResolvedValue({
      items: [contractRecord, { ...contractRecord, id: 'c-2' }],
      total: 2,
    });
    parties.findCounterparties.mockResolvedValue([
      { contractId: 'c-1', companyName: 'Bravo Energy', partyType: 'client' },
      { contractId: 'c-1', companyName: 'Delta Supply', partyType: 'vendor' },
    ]);

    const result = await service.list('u', 'co-1', { page: 1, limit: 10 });

    // Only the verified company and this page's (already scoped) contracts.
    expect(parties.findCounterparties).toHaveBeenCalledTimes(1);
    expect(parties.findCounterparties).toHaveBeenCalledWith('co-1', [
      'c-1',
      'c-2',
    ]);
    expect(result.data[0].counterparties).toEqual([
      { companyName: 'Bravo Energy', partyType: 'client' },
      { companyName: 'Delta Supply', partyType: 'vendor' },
    ]);
    expect(result.data[1].counterparties).toEqual([]);
    // Only the name and party type: no IDs or signatory details.
    expect(Object.keys(result.data[0].counterparties[0]).sort()).toEqual([
      'companyName',
      'partyType',
    ]);
  });

  it('lists no parties for archived contracts', async () => {
    contracts.searchPage.mockResolvedValue({
      items: [{ ...contractRecord, deletedAt: new Date('2026-06-01') }],
      total: 1,
    });

    const result = await service.list('u', 'co-1', {
      page: 1,
      limit: 10,
      includeDeleted: true,
    });

    expect(parties.findCounterparties).not.toHaveBeenCalled();
    expect(result.data[0].counterparties).toEqual([]);
  });

  it('narrows the list to the member\'s own assignments only when asked', async () => {
    contracts.searchPage.mockResolvedValue({ items: [], total: 0 });

    await service.list('u', 'co-1', { page: 1, limit: 10 });
    expect(contracts.searchPage).toHaveBeenLastCalledWith(
      {
        companyId: 'co-1',
        companyUserId: 'cu-1',
        includeCompanyAdminOversight: true,
      },
      expect.objectContaining({ assignedToCompanyUserId: undefined }),
    );

    await service.list('u', 'co-1', { page: 1, limit: 10, assignedToMe: true });
    // The membership comes from the verified header company, never the request.
    expect(contracts.searchPage).toHaveBeenLastCalledWith(
      {
        companyId: 'co-1',
        companyUserId: 'cu-1',
        includeCompanyAdminOversight: true,
      },
      expect.objectContaining({ assignedToCompanyUserId: 'cu-1' }),
    );
  });

  it("adds the member's own roles, with their workspace, to each row", async () => {
    contracts.searchPage.mockResolvedValue({
      items: [contractRecord, { ...contractRecord, id: 'c-2' }],
      total: 2,
    });
    roleAssignments.findActiveRolesForContracts.mockResolvedValue([
      { contractId: 'c-1', role: 'Finance Officer', isWorkspaceAdmin: true },
      { contractId: 'c-1', role: 'HSE Officer', isWorkspaceAdmin: false },
    ]);

    const result = await service.list('u', 'co-1', { page: 1, limit: 10 });

    expect(roleAssignments.findActiveRolesForContracts).toHaveBeenCalledWith(
      { companyId: 'co-1' },
      'cu-1',
      ['c-1', 'c-2'],
    );
    expect(result.data[0].myRoles).toEqual([
      { role: 'Finance Officer', workspace: 'finance', isWorkspaceAdmin: true },
      { role: 'HSE Officer', workspace: 'hse', isWorkspaceAdmin: false },
    ]);
    expect(result.data[1].myRoles).toEqual([]);
  });

  it('reads no roles for archived contracts', async () => {
    contracts.searchPage.mockResolvedValue({
      items: [{ ...contractRecord, deletedAt: new Date('2026-06-01') }],
      total: 1,
    });

    const result = await service.list('u', 'co-1', {
      page: 1,
      limit: 10,
      includeDeleted: true,
    });

    expect(roleAssignments.findActiveRolesForContracts).not.toHaveBeenCalled();
    expect(result.data[0].myRoles).toEqual([]);
  });
});
