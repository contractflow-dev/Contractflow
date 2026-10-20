import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractService } from './contract.service';

describe('ContractService', () => {
  const scopeFor = { forUser: vi.fn() };
  const parties = { findForContract: vi.fn() };
  const history = { findForContract: vi.fn() };
  const contracts = { findById: vi.fn(), searchPage: vi.fn() };
  const partyRows = { find: vi.fn() };
  let service: ContractService;

  beforeEach(() => {
    vi.resetAllMocks();
    scopeFor.forUser.mockResolvedValue({ companyId: 'co-1' });
    service = new ContractService(
      scopeFor as never,
      parties as never,
      history as never,
      contracts as never,
      partyRows as never,
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
    parties.findForContract.mockResolvedValue([]);

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
    expect(history.findForContract).not.toHaveBeenCalled();
    expect(partyRows.find).not.toHaveBeenCalled();
  });

  it('returns a contract for a party company', async () => {
    const party = { id: 'p-1' };
    parties.findForContract.mockResolvedValue([party]);
    contracts.findById.mockResolvedValue({ id: 'c-1' });

    await expect(service.get('u', 'co-1', 'c-1')).resolves.toEqual({
      contract: { id: 'c-1' },
      membership: party,
    });
    expect(contracts.findById).toHaveBeenCalledWith('c-1', {
      companyId: 'co-1',
    });
    expect(parties.findForContract).toHaveBeenCalledWith('c-1', {
      companyId: 'co-1',
    });
  });

  it('exposes only minimal counterparty details', async () => {
    parties.findForContract.mockResolvedValue([{ id: 'p-1' }]);
    contracts.findById.mockResolvedValue({ id: 'c-1' });
    partyRows.find.mockResolvedValue([
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
  });

  it('scopes status history to the contract and the verified company', async () => {
    parties.findForContract.mockResolvedValue([{ id: 'p-1' }]);
    history.findForContract.mockResolvedValue({ items: [], total: 0 });

    await service.listStatusHistory('u', 'co-1', 'c-1', { page: 3, limit: 10 });

    expect(history.findForContract).toHaveBeenCalledWith(
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
    expect(result).toEqual({ items: [], total: 0, page: 2, limit: 5 });
  });
});
