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
  const scopeFor = { forUser: vi.fn() };
  const parties = { findByCompany: vi.fn(), findAllWithCompany: vi.fn() };
  const history = { searchPage: vi.fn() };
  const contracts = { findById: vi.fn(), searchPage: vi.fn() };
  const companyUsers = { findActiveRoleForUser: vi.fn() };
  const workspaces = { findWorkspaces: vi.fn() };
  let service: ContractService;

  beforeEach(() => {
    vi.resetAllMocks();
    scopeFor.forUser.mockResolvedValue({ companyId: 'co-1' });
    parties.findByCompany.mockResolvedValue({
      id: 'p-1',
      companyId: 'co-1',
      partyType: 'contractor',
      signedAt: null,
      signatoryFirstName: 'Private',
      signatoryLastName: 'Signatory',
    });
    parties.findAllWithCompany.mockResolvedValue([]);
    history.searchPage.mockResolvedValue({ items: [], total: 0 });
    contracts.findById.mockResolvedValue(contractRecord);
    companyUsers.findActiveRoleForUser.mockResolvedValue(
      ECompanyRole.COMPANY_ADMIN,
    );
    workspaces.findWorkspaces.mockResolvedValue(['general', 'finance']);
    service = new ContractService(
      scopeFor as never,
      parties as never,
      history as never,
      contracts as never,
      companyUsers as never,
      workspaces as never,
    );
  });

  it('rejects users who are not active members of the company', async () => {
    scopeFor.forUser.mockRejectedValue(new ForbiddenException());

    await expect(service.get('u', 'co-1', 'c-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.list('u', 'co-1', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(contracts.findById).not.toHaveBeenCalled();
    expect(contracts.searchPage).not.toHaveBeenCalled();
  });

  it('hides contracts the company is not a party to', async () => {
    parties.findByCompany.mockResolvedValue(null);

    await expect(service.get('u', 'co-1', 'c-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.listStatusHistory('u', 'co-1', 'c-9', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.listParties('u', 'co-1', 'c-9'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(contracts.findById).not.toHaveBeenCalled();
    expect(history.searchPage).not.toHaveBeenCalled();
    expect(parties.findAllWithCompany).not.toHaveBeenCalled();
  });

  it('returns a contract for a party company', async () => {
    const party = {
      id: 'p-1',
      companyId: 'co-1',
      partyType: 'contractor',
      signedAt: null,
      signatoryFirstName: 'Private',
      signatoryLastName: 'Signatory',
    };
    parties.findByCompany.mockResolvedValue(party);
    contracts.findById.mockResolvedValue(contractRecord);

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
    expect(contracts.findById).toHaveBeenCalledWith(
      { companyId: 'co-1' },
      'c-1',
    );
    expect(parties.findByCompany).toHaveBeenCalledWith(
      { contractId: 'c-1', companyId: 'co-1' },
      'co-1',
    );
  });

  it('hides archived contracts from party, history, and detail reads', async () => {
    contracts.findById.mockResolvedValue(null);

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
      { companyId: 'co-1' },
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
      { companyId: 'co-1' },
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
      { companyId: 'co-1' },
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

  it('lists workspaces only through the verified contract party scope', async () => {
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
});
