import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { CompanyService } from './company.service';

const companyData = {
  id: '01JCOMPANY00000000000000000',
  name: 'ContractFlow Test Ltd',
  legalName: 'ContractFlow Test Limited',
  registrationNumber: 'REG-1',
  taxIdentificationNumber: 'TAX-1',
  email: 'company@example.com',
  phoneNumber: '+10000000000',
  website: '',
  addressLine1: '1 Test Street',
  addressLine2: '',
  city: 'Test City',
  stateRegion: 'Test Region',
  postalCode: '00000',
  countryCode: 'US',
  defaultCurrencyCode: 'USD',
  status: ECompanyStatus.ACTIVE,
};

const companyInput = {
  name: companyData.name,
  legalName: companyData.legalName,
  registrationNumber: companyData.registrationNumber,
  taxIdentificationNumber: companyData.taxIdentificationNumber,
  email: companyData.email,
  phoneNumber: companyData.phoneNumber,
  addressLine1: companyData.addressLine1,
  city: companyData.city,
  stateRegion: companyData.stateRegion,
  postalCode: companyData.postalCode,
  countryCode: companyData.countryCode,
  defaultCurrencyCode: companyData.defaultCurrencyCode,
};

describe('CompanyService', () => {
  let service: CompanyService;
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let companyRepository: Record<string, ReturnType<typeof vi.fn>>;
  let membershipRepository: Record<string, ReturnType<typeof vi.fn>>;
  let transaction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    users = {
      findOne: vi.fn().mockResolvedValue({
        id: '01JUSER0000000000000000000',
        status: EUserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      }),
    };
    companyRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => ({ ...companyData, ...value })),
    };
    membershipRepository = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => ({
        id: '01JMEMBER000000000000000000',
        createdAt: new Date(),
        ...value,
      })),
      find: vi.fn(),
      findOne: vi.fn(),
      count: vi.fn(),
    };
    const manager = {
      getRepository: (entity: typeof AppUser | typeof Company | typeof CompanyUser) =>
        entity === AppUser
          ? users
          : entity === Company
            ? companyRepository
            : membershipRepository,
    };
    transaction = vi.fn(
      async <T>(work: (manager: EntityManager) => Promise<T>) =>
        work(manager as unknown as EntityManager),
    );
    service = new CompanyService(
      { transaction } as unknown as DataSource,
      membershipRepository as unknown as Repository<CompanyUser>,
    );
  });

  it('creates a company and its server-assigned administrator in one transaction', async () => {
    const response = await service.create('user-from-session', companyInput);

    expect(transaction).toHaveBeenCalledOnce();
    expect(companyRepository.save).toHaveBeenCalledOnce();
    expect(membershipRepository.save).toHaveBeenCalledOnce();
    expect(membershipRepository.save.mock.calls[0][0]).toMatchObject({
      companyId: companyData.id,
      userId: '01JUSER0000000000000000000',
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
    });
    expect(response.company).toMatchObject({ id: companyData.id });
    expect(response.membership.canManageCompany).toBe(true);
    expect(response.membership).not.toHaveProperty('userId');
  });

  it('rejects unauthenticated identity and unverified accounts before writes', async () => {
    users.findOne.mockResolvedValueOnce(null);
    await expect(
      service.create('missing-user', companyInput),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(companyRepository.save).not.toHaveBeenCalled();

    users.findOne.mockResolvedValueOnce({
      id: 'user-id',
      status: EUserStatus.ACTIVE,
      emailVerifiedAt: null,
    });
    await expect(
      service.create('unverified-user', companyInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(companyRepository.save).not.toHaveBeenCalled();
  });

  it('propagates a membership failure so the encompassing transaction rolls back', async () => {
    membershipRepository.save.mockRejectedValueOnce(
      new Error('membership insert failed'),
    );

    await expect(
      service.create('01JUSER0000000000000000000', companyInput),
    ).rejects.toThrow('membership insert failed');
    expect(companyRepository.save).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('lists only active memberships belonging to the requested user', async () => {
    const membership = {
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      company: companyData,
    };
    membershipRepository.find.mockResolvedValue([membership]);

    const companies = await service.listForUser('current-user');

    expect(membershipRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'current-user',
          status: ECompanyUserStatus.ACTIVE,
        },
      }),
    );
    expect(companies).toHaveLength(1);
    expect(companies[0].company.id).toBe(companyData.id);
  });

  it('requires active membership and administrator role for dashboard data', async () => {
    membershipRepository.findOne.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.CONTRACTOR_PROJECT_LEAD,
      status: ECompanyUserStatus.ACTIVE,
      company: companyData,
    });
    await expect(
      service.getDashboard('user-id', companyData.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(membershipRepository.count).not.toHaveBeenCalled();

    membershipRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.getMembership('another-user', companyData.id),
    ).rejects.toThrow('Company membership was not found.');
  });

  it('returns a database-backed company-member summary to an administrator', async () => {
    membershipRepository.findOne.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      company: companyData,
    });
    membershipRepository.count.mockResolvedValue(3);

    await expect(
      service.getDashboard('admin-user', companyData.id),
    ).resolves.toMatchObject({
      company: { id: companyData.id },
      membership: { canManageCompany: true },
      summary: { activeMembershipCount: 3 },
    });
    expect(membershipRepository.count).toHaveBeenCalledWith({
      where: {
        companyId: companyData.id,
        status: ECompanyUserStatus.ACTIVE,
      },
    });
  });

  it('reports an existing database-level unique membership index', () => {
    const index = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === CompanyUser &&
        item.name === 'uq_company_user_company_user',
    );
    expect(index?.unique).toBe(true);
  });
});
