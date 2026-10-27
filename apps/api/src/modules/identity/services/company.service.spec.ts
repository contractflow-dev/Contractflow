import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EContractStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUser } from '../entities/app-user.entity';
import { Company } from '../entities/company.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { ContractParty } from '../../contract/entities/contract-party.entity';
import { CompanyInvitationRepository } from '../repositories/company-invitation.repository';
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
  let invitationRepository: Record<string, ReturnType<typeof vi.fn>>;
  let contractPartyRepository: Record<string, ReturnType<typeof vi.fn>>;
  let contractQueryBuilder: Record<string, ReturnType<typeof vi.fn>>;
  let configService: { get: ReturnType<typeof vi.fn> };
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
    invitationRepository = {
      countPending: vi.fn().mockResolvedValue(2),
    };
    const queryBuilder = {
      innerJoin: vi.fn(),
      distinct: vi.fn(),
      select: vi.fn(),
      addSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      addOrderBy: vi.fn(),
      take: vi.fn(),
      getRawOne: vi
        .fn()
        .mockResolvedValueOnce({ count: '7' })
        .mockResolvedValueOnce({ count: '4' })
        .mockResolvedValueOnce({ count: '1' }),
      getRawMany: vi.fn().mockResolvedValue([]),
    };
    queryBuilder.innerJoin.mockReturnValue(queryBuilder);
    queryBuilder.distinct.mockReturnValue(queryBuilder);
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.addOrderBy.mockReturnValue(queryBuilder);
    queryBuilder.take.mockReturnValue(queryBuilder);
    contractPartyRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };
    contractQueryBuilder = queryBuilder;
    configService = {
      get: vi.fn().mockReturnValue(30),
    };
    const manager = {
      getRepository: (
        entity: typeof AppUser | typeof Company | typeof CompanyUser,
      ) =>
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
      configService as unknown as ConfigService,
      { transaction } as unknown as DataSource,
      membershipRepository as unknown as Repository<CompanyUser>,
      invitationRepository as unknown as CompanyInvitationRepository,
      contractPartyRepository as unknown as Repository<ContractParty>,
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
          leftAt: expect.anything(),
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
    expect(membershipRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-id',
          companyId: companyData.id,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: expect.anything(),
        },
      }),
    );
    expect(membershipRepository.count).not.toHaveBeenCalled();
    expect(contractPartyRepository.createQueryBuilder).not.toHaveBeenCalled();

    membershipRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.getMembership('another-user', companyData.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a database-backed company-member summary to an administrator', async () => {
    membershipRepository.findOne.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
      company: companyData,
    });
    membershipRepository.count.mockResolvedValue(3);

    const queryBuilder = contractQueryBuilder;
    const expiringRows = [
      {
        id: 'contract-expiring',
        referenceNumber: 'CTR-EXP-1',
        title: 'Expiring contract',
        status: EContractStatus.ACTIVE,
        endDate: '2026-11-01',
        updatedAt: '2026-10-20T09:00:00.000Z',
      },
    ];
    queryBuilder.getRawMany
      .mockResolvedValueOnce(expiringRows)
      .mockResolvedValueOnce([
        {
          id: 'contract-recent',
          referenceNumber: 'CTR-RECENT-1',
          title: 'Recently updated contract',
          status: EContractStatus.DRAFT,
          endDate: null,
          updatedAt: new Date('2026-10-21T09:00:00.000Z'),
        },
      ]);

    await expect(
      service.getDashboard('admin-user', companyData.id),
    ).resolves.toMatchObject({
      company: { id: companyData.id },
      membership: { canManageCompany: true },
      summary: {
        activeMembershipCount: 3,
        pendingInvitationCount: 2,
        totalContractCount: 7,
        activeContractCount: 4,
        expiringContractCount: 1,
      },
      expiryWindowDays: 30,
      expiringContracts: [
        {
          id: 'contract-expiring',
          referenceNumber: 'CTR-EXP-1',
          endDate: '2026-11-01',
        },
      ],
      recentlyUpdatedContracts: [
        {
          id: 'contract-recent',
          referenceNumber: 'CTR-RECENT-1',
          endDate: null,
          updatedAt: '2026-10-21T09:00:00.000Z',
        },
      ],
    });
    expect(membershipRepository.count).toHaveBeenCalledWith({
      where: {
        companyId: companyData.id,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: expect.anything(),
      },
    });
    expect(invitationRepository.countPending).toHaveBeenCalledWith({
      companyId: companyData.id,
    });
    expect(contractPartyRepository.createQueryBuilder).toHaveBeenCalledTimes(5);
    expect(queryBuilder.where).toHaveBeenCalledTimes(5);
    for (const [index] of queryBuilder.where.mock.calls.entries()) {
      expect(queryBuilder.where).toHaveBeenNthCalledWith(
        index + 1,
        'party.companyId = :companyId',
        {
          companyId: companyData.id,
        },
      );
    }
    expect(
      contractPartyRepository.createQueryBuilder.mock.results[0].value.where,
    ).toHaveBeenCalledWith('party.companyId = :companyId', {
      companyId: companyData.id,
    });
    const expiringCountQuery =
      contractPartyRepository.createQueryBuilder.mock.results[2].value;
    expect(expiringCountQuery.andWhere).toHaveBeenCalledWith(
      'contract.status = :status',
      {
        status: EContractStatus.ACTIVE,
      },
    );
    expect(expiringCountQuery.andWhere).toHaveBeenCalledWith(
      'COALESCE(contract.revisedEndDate, contract.endDate) BETWEEN :today AND :expiryLimit',
      expect.objectContaining({
        today: expect.any(String),
        expiryLimit: expect.any(String),
      }),
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'party.companyId = :companyId',
      { companyId: companyData.id },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'COALESCE(contract.revisedEndDate, contract.endDate)',
      'ASC',
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledTimes(2);
    const recentQuery =
      contractPartyRepository.createQueryBuilder.mock.results[4].value;
    expect(recentQuery.andWhere).toHaveBeenCalledWith(
      'contract.updatedAt >= :updatedSince',
      { updatedSince: expect.any(Date) },
    );
    expect(recentQuery.orderBy).toHaveBeenCalledWith(
      'contract.updatedAt',
      'DESC',
    );
  });

  it('returns empty contract lists when the company has no matching contracts', async () => {
    membershipRepository.findOne.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
      company: companyData,
    });
    membershipRepository.count.mockResolvedValue(1);
    contractQueryBuilder.getRawOne
      .mockReset()
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ count: '0' });

    const result = await service.getDashboard('admin-user', companyData.id);

    expect(result.summary.totalContractCount).toBe(0);
    expect(result.summary.activeContractCount).toBe(0);
    expect(result.summary.expiringContractCount).toBe(0);
    expect(result.expiringContracts).toEqual([]);
    expect(result.recentlyUpdatedContracts).toEqual([]);
  });

  it('uses the configured contract expiry window in the response and filter', async () => {
    membershipRepository.findOne.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
      company: companyData,
    });
    membershipRepository.count.mockResolvedValue(1);
    configService.get.mockReturnValue(45);

    const result = await service.getDashboard('admin-user', companyData.id);
    const dateFilter = contractQueryBuilder.andWhere.mock.calls.find(
      ([condition]) => condition.includes('BETWEEN :today AND :expiryLimit'),
    );
    if (!dateFilter) {
      throw new Error('Expected the dashboard expiry date filter');
    }
    const { today, expiryLimit } = dateFilter[1] as {
      today: string;
      expiryLimit: string;
    };

    expect(result.expiryWindowDays).toBe(45);
    expect(configService.get).toHaveBeenCalledWith(
      'COMPANY_DASHBOARD_EXPIRY_WINDOW_DAYS',
      30,
    );
    expect(
      (Date.parse(`${expiryLimit}T00:00:00Z`) -
        Date.parse(`${today}T00:00:00Z`)) /
        86400000,
    ).toBe(45);
  });

  it('reports an existing database-level unique membership index', () => {
    const index = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === CompanyUser &&
        item.name === 'uq_company_user_active_company_user',
    );
    expect(index?.unique).toBe(true);
  });
});
