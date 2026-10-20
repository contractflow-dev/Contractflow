import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyInvitation } from '../entities/company-invitation.entity';
import { CompanyInvitationRepository } from './company-invitation.repository';

describe('CompanyInvitationRepository', () => {
  let repository: CompanyInvitationRepository;
  let queryBuilder: {
    alias: string;
    andWhere: ReturnType<typeof vi.fn>;
    getCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryBuilder = {
      alias: 'invitation',
      andWhere: vi.fn(),
      getCount: vi.fn().mockResolvedValue(2),
    };
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    const entityRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };
    repository = new CompanyInvitationRepository(
      entityRepository as unknown as Repository<CompanyInvitation>,
    );
  });

  it('counts pending unexpired invitations without losing company scope', async () => {
    const at = new Date('2026-10-19T09:00:00.000Z');

    await expect(
      repository.countPending({ companyId: 'company-1' }, at),
    ).resolves.toBe(2);

    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'invitation.companyId = :__scopeCompanyId',
      { __scopeCompanyId: 'company-1' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'invitation.status = :status',
      { status: 'pending' },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      3,
      'invitation.expiresAt > :at',
      { at },
    );
  });
});
