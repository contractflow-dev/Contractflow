import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ECompanyRole } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractAccessService } from './contract-access.service';
import { ContractResourceReader } from './contract-resource-reader';

describe('ContractAccessService', () => {
  const users = { findActiveMember: vi.fn() };
  const parties = { findByCompany: vi.fn() };
  let service: ContractAccessService;

  beforeEach(() => {
    vi.resetAllMocks();
    users.findActiveMember.mockResolvedValue({
      id: 'm1',
      companyRole: ECompanyRole.FINANCE_OFFICER,
    });
    parties.findByCompany.mockResolvedValue({ id: 'p1' });
    service = new ContractAccessService(users as never, parties as never);
  });

  it('returns a trusted scope for a permitted finance member', async () => {
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).resolves.toEqual({ contractId: 'c1', companyId: 'co1' });
    expect(users.findActiveMember).toHaveBeenCalledWith('u1', {
      companyId: 'co1',
    });
    expect(parties.findByCompany).toHaveBeenCalledWith('co1', {
      contractId: 'c1',
      companyId: 'co1',
    });
  });

  it('rejects non-members before touching contract data', async () => {
    users.findActiveMember.mockResolvedValue(null);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'finance'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(parties.findByCompany).not.toHaveBeenCalled();
  });

  it('hides contracts the company is not a party to', async () => {
    parties.findByCompany.mockResolvedValue(null);
    await expect(
      service.authorize('u1', 'co1', 'other', 'finance'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps workspaces separate and gives Company Administrators no workspace access', async () => {
    await expect(
      service.authorize('u1', 'co1', 'c1', 'project'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.authorize('u1', 'co1', 'c1', 'general'),
    ).resolves.toBeDefined();
    users.findActiveMember.mockResolvedValue({
      id: 'm1',
      companyRole: ECompanyRole.COMPANY_ADMIN,
    });
    await expect(
      service.authorize('u1', 'co1', 'c1', 'general'),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
    expect(result).toMatchObject({ total: 1, page: 3, limit: 10 });
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
