import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { getMetadataArgsStorage } from 'typeorm';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EContractStatus,
  ECountryCode,
  ECurrencyCode,
  EUserStatus,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyUser } from '../../entities/company-user.entity';
import { CompanyInvitationRepository } from '../../repositories/company-invitation.repository';
import { CompanyUserRepository } from '../../repositories/company-user.respository';
import { ContractPartyRepository } from '../../../contract/repositories/contract-party.repository';
import { CompanyService } from './company.service';
import type { CompanyVerificationService } from './company-verification.service';

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
  countryCode: ECountryCode.US,
  defaultCurrencyCode: ECurrencyCode.USD,
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
  let companyVerification: { sendAfterEmailChange: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let execute: ReturnType<typeof vi.fn>;
  let companyCreationContext: Record<string, ReturnType<typeof vi.fn>>;

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
      findActiveMembershipsForUser: vi.fn(),
      findAllMembershipsForUser: vi.fn(),
      findCurrentMembershipWithCompany: vi.fn(),
      findActiveMembershipWithCompany: vi.fn(),
      countActiveMembers: vi.fn(),
    };
    invitationRepository = {
      countPending: vi.fn().mockResolvedValue(2),
    };
    contractPartyRepository = {
      countCompanyContracts: vi.fn().mockResolvedValue(0),
      countExpiringCompanyContracts: vi.fn().mockResolvedValue(1),
      findExpiringCompanyContracts: vi.fn().mockResolvedValue([]),
      findRecentlyUpdatedCompanyContracts: vi.fn().mockResolvedValue([]),
    };
    configService = {
      get: vi.fn().mockReturnValue(30),
    };
    companyCreationContext = {
      findUserById: vi.fn((id) => users.findOne({ where: { id } })),
      createCompany: vi.fn(async (value) =>
        companyRepository.save(companyRepository.create(value)),
      ),
      createMembership: vi.fn(async (value) =>
        membershipRepository.save(membershipRepository.create(value)),
      ),
    };
    execute = vi.fn(
      async <T>(work: (context: typeof companyCreationContext) => Promise<T>) =>
        work(companyCreationContext),
    );
    companyVerification = { sendAfterEmailChange: vi.fn() };
    service = new CompanyService(
      configService as unknown as ConfigService,
      { execute } as unknown as ConstructorParameters<typeof CompanyService>[1],
      membershipRepository as unknown as CompanyUserRepository,
      invitationRepository as unknown as CompanyInvitationRepository,
      contractPartyRepository as unknown as ContractPartyRepository,
      companyVerification as unknown as CompanyVerificationService,
    );
  });

  it('creates a company and its server-assigned administrator in one transaction', async () => {
    const response = await service.create('user-from-session', companyInput);

    expect(execute).toHaveBeenCalledOnce();
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
    expect(companyVerification.sendAfterEmailChange).toHaveBeenCalledWith(
      companyData.id,
    );
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
    expect(execute).toHaveBeenCalledOnce();
  });

  it('lists only active memberships belonging to the requested user', async () => {
    const membership = {
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      company: companyData,
    };
    const inactiveMembership = {
      ...membership,
      id: 'inactive-membership-id',
      company: { ...companyData, status: ECompanyStatus.INACTIVE },
    };
    membershipRepository.findActiveMembershipsForUser.mockResolvedValue([
      membership,
      inactiveMembership,
    ]);

    const companies = await service.listForUser('current-user');

    expect(
      membershipRepository.findActiveMembershipsForUser,
    ).toHaveBeenCalledWith('current-user');
    expect(companies).toHaveLength(1);
    expect(companies[0].company.id).toBe(companyData.id);
  });

  it('summarizes why a user has or lacks company access without exposing companies', async () => {
    const active = {
      id: 'active-membership',
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
      company: companyData,
    };
    const removed = {
      ...active,
      id: 'removed-membership',
      status: ECompanyUserStatus.INACTIVE,
      leftAt: new Date('2026-01-01T00:00:00Z'),
    };
    const inactiveCompany = {
      ...active,
      id: 'inactive-company-membership',
      company: { ...companyData, status: ECompanyStatus.INACTIVE },
    };
    membershipRepository.findAllMembershipsForUser.mockResolvedValue([
      active,
      removed,
      inactiveCompany,
    ]);

    await expect(service.getAccessSummary('current-user')).resolves.toEqual({
      activeCompanyCount: 1,
      hasEndedMembership: true,
      hasInactiveCompanyMembership: true,
    });
    expect(
      membershipRepository.findAllMembershipsForUser,
    ).toHaveBeenCalledWith('current-user');
  });

  it('reports a new user with no memberships as having nothing to recover', async () => {
    membershipRepository.findAllMembershipsForUser.mockResolvedValue([]);

    await expect(service.getAccessSummary('new-user')).resolves.toEqual({
      activeCompanyCount: 0,
      hasEndedMembership: false,
      hasInactiveCompanyMembership: false,
    });
  });

  it('requires active membership and administrator role for dashboard data', async () => {
    membershipRepository.findActiveMembershipWithCompany.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.CONTRACTOR_PROJECT_LEAD,
      status: ECompanyUserStatus.ACTIVE,
      company: companyData,
    });
    await expect(
      service.getDashboard('user-id', companyData.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      membershipRepository.findActiveMembershipWithCompany,
    ).toHaveBeenCalledWith('user-id', companyData.id);
    expect(membershipRepository.countActiveMembers).not.toHaveBeenCalled();
    expect(
      contractPartyRepository.countCompanyContracts,
    ).not.toHaveBeenCalled();

    membershipRepository.findActiveMembershipWithCompany.mockResolvedValueOnce(
      null,
    );
    await expect(
      service.getMembership('another-user', companyData.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a database-backed company-member summary to an administrator', async () => {
    membershipRepository.findActiveMembershipWithCompany.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
      company: companyData,
    });
    membershipRepository.countActiveMembers.mockResolvedValue(3);
    contractPartyRepository.countCompanyContracts
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(4);
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
    contractPartyRepository.findExpiringCompanyContracts.mockResolvedValueOnce(
      expiringRows,
    );
    contractPartyRepository.findRecentlyUpdatedCompanyContracts.mockResolvedValueOnce(
      [
        {
          id: 'contract-recent',
          referenceNumber: 'CTR-RECENT-1',
          title: 'Recently updated contract',
          status: EContractStatus.DRAFT,
          endDate: null,
          updatedAt: new Date('2026-10-21T09:00:00.000Z'),
        },
      ],
    );

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
    expect(membershipRepository.countActiveMembers).toHaveBeenCalledWith(
      companyData.id,
    );
    expect(invitationRepository.countPending).toHaveBeenCalledWith({
      companyId: companyData.id,
    });
    expect(
      contractPartyRepository.countCompanyContracts,
    ).toHaveBeenNthCalledWith(1, companyData.id);
    expect(
      contractPartyRepository.countCompanyContracts,
    ).toHaveBeenNthCalledWith(2, companyData.id, EContractStatus.ACTIVE);
    expect(
      contractPartyRepository.countExpiringCompanyContracts,
    ).toHaveBeenCalledWith(
      companyData.id,
      expect.any(String),
      expect.any(String),
    );
    expect(
      contractPartyRepository.findExpiringCompanyContracts,
    ).toHaveBeenCalledWith(
      companyData.id,
      expect.any(String),
      expect.any(String),
      5,
    );
    expect(
      contractPartyRepository.findRecentlyUpdatedCompanyContracts,
    ).toHaveBeenCalledWith(companyData.id, expect.any(Date), 5);
  });

  it('returns empty contract lists when the company has no matching contracts', async () => {
    membershipRepository.findActiveMembershipWithCompany.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
      company: companyData,
    });
    membershipRepository.countActiveMembers.mockResolvedValue(1);
    contractPartyRepository.countCompanyContracts.mockResolvedValue(0);
    contractPartyRepository.countExpiringCompanyContracts.mockResolvedValue(0);

    const result = await service.getDashboard('admin-user', companyData.id);

    expect(result.summary.totalContractCount).toBe(0);
    expect(result.summary.activeContractCount).toBe(0);
    expect(result.summary.expiringContractCount).toBe(0);
    expect(result.expiringContracts).toEqual([]);
    expect(result.recentlyUpdatedContracts).toEqual([]);
  });

  it('uses the configured contract expiry window in the response and filter', async () => {
    membershipRepository.findActiveMembershipWithCompany.mockResolvedValue({
      id: 'membership-id',
      companyId: companyData.id,
      companyRole: ECompanyRole.COMPANY_ADMIN,
      status: ECompanyUserStatus.ACTIVE,
      leftAt: null,
      company: companyData,
    });
    membershipRepository.countActiveMembers.mockResolvedValue(1);
    configService.get.mockReturnValue(45);

    const result = await service.getDashboard('admin-user', companyData.id);
    const [, today, expiryLimit] =
      contractPartyRepository.countExpiringCompanyContracts.mock.calls[0];

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
