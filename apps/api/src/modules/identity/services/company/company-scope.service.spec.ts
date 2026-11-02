import { ForbiddenException } from '@nestjs/common';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyUserRepository } from '../../repositories/company-user.respository';
import { CompanyScopeService } from './company-scope.service';

describe('CompanyScopeService', () => {
  const companyId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const membership = {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    companyId,
    companyRole: ECompanyRole.COMPANY_ADMIN,
    status: ECompanyUserStatus.ACTIVE,
    leftAt: null,
    company: { status: ECompanyStatus.ACTIVE },
  };
  const companyUsers = {
    findActiveMembershipWithCompany: vi.fn(),
  };
  let service: CompanyScopeService;

  beforeEach(() => {
    vi.clearAllMocks();
    companyUsers.findActiveMembershipWithCompany.mockResolvedValue(membership);
    service = new CompanyScopeService(
      companyUsers as unknown as CompanyUserRepository,
    );
  });

  it('returns a typed active membership context', async () => {
    await expect(service.contextForUser('user-id', companyId)).resolves.toEqual(
      {
        companyId,
        companyStatus: ECompanyStatus.ACTIVE,
        membership: {
          id: membership.id,
          companyId,
          companyRole: ECompanyRole.COMPANY_ADMIN,
          status: ECompanyUserStatus.ACTIVE,
        },
      },
    );
  });

  it('rejects missing membership and inactive companies', async () => {
    companyUsers.findActiveMembershipWithCompany.mockResolvedValue(null);
    await expect(
      service.contextForUser('user-id', companyId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    companyUsers.findActiveMembershipWithCompany.mockResolvedValue({
      ...membership,
      company: { status: ECompanyStatus.INACTIVE },
    });
    await expect(
      service.contextForUser('user-id', companyId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('preserves the existing explicit company scope API', async () => {
    await expect(service.forUser('user-id', ` ${companyId} `)).resolves.toEqual(
      { companyId },
    );
    expect(companyUsers.findActiveMembershipWithCompany).toHaveBeenCalledWith(
      'user-id',
      companyId,
    );
  });
});
