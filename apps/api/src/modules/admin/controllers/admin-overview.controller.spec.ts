import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from '../services/admin-overview.service';
import { AdminOverviewResponseDto } from '../dto/admin-overview-response.dto';
import { Repository } from 'typeorm';
import { Company } from '../../identity/entities/company.entity';
import { AppUser } from '../../identity/entities/app-user.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { CompanyInvitation } from '../../identity/entities/company-invitation.entity';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';

describe('AdminOverviewController & AdminOverviewService', () => {
  let controller: AdminOverviewController;
  let service: AdminOverviewService;

  let companyRepo: Record<string, any>;
  let userRepo: Record<string, any>;
  let contractRepo: Record<string, any>;
  let invitationRepo: Record<string, any>;
  let activityLogRepo: Record<string, any>;

  const mockOverviewResponse: AdminOverviewResponseDto = {
    companies: { total: 10, active: 8, inactive: 2, newThisMonth: 3 },
    users: { total: 45, active: 40, inactive: 5, pendingVerification: 4, platformAdmins: 2 },
    contracts: { total: 15, active: 10, draft: 3, suspended: 1, completed: 1, expiringSoon: 2 },
    invitations: { total: 20, pending: 5, accepted: 12, declined: 3, expired: 1 },
    attention: {
      expiringContractsCount: 2,
      pendingInvitationsCount: 5,
      unverifiedUsersCount: 4,
      items: [],
    },
    recentActivity: [
      {
        id: '01JLOG0000000000000000000',
        action: 'contract.created',
        entityType: 'contract',
        entityId: '01JCNT0000000000000000000',
        summary: 'Contract created: CTR-2026-001',
        actorName: 'John Doe',
        companyName: 'Acme Energy',
        occurredAt: new Date().toISOString(),
      },
    ],
    generatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    companyRepo = {
      createQueryBuilder: vi.fn(),
    };
    userRepo = {
      createQueryBuilder: vi.fn(),
    };
    contractRepo = {
      createQueryBuilder: vi.fn(),
    };
    invitationRepo = {
      createQueryBuilder: vi.fn(),
    };
    activityLogRepo = {
      createQueryBuilder: vi.fn(),
    };

    service = new AdminOverviewService(
      companyRepo as unknown as Repository<Company>,
      userRepo as unknown as Repository<AppUser>,
      contractRepo as unknown as Repository<Contract>,
      invitationRepo as unknown as Repository<CompanyInvitation>,
      activityLogRepo as unknown as Repository<ActivityLog>,
    );

    controller = new AdminOverviewController(service);
  });

  describe('AdminOverviewController', () => {
    it('returns overview data from service', async () => {
      vi.spyOn(service, 'getOverview').mockResolvedValue(mockOverviewResponse);

      const result = await controller.getOverview();
      expect(result).toEqual(mockOverviewResponse);
      expect(result.companies.total).toBe(10);
      expect(result.users.total).toBe(45);
      expect(result.contracts.active).toBe(10);
    });
  });

  describe('AdminOverviewService query logic', () => {
    it('aggregates metrics correctly and handles empty database states', async () => {
      // Mock raw queries returning null/empty
      companyRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue(null),
      });

      userRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue(null),
      });

      contractRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue(null),
        getMany: vi.fn().mockResolvedValue([]),
      });

      invitationRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue(null),
        getMany: vi.fn().mockResolvedValue([]),
      });

      activityLogRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      });

      const overview = await service.getOverview();

      expect(overview.companies).toEqual({
        total: 0,
        active: 0,
        inactive: 0,
        newThisMonth: 0,
      });
      expect(overview.users).toEqual({
        total: 0,
        active: 0,
        inactive: 0,
        pendingVerification: 0,
        platformAdmins: 0,
      });
      expect(overview.contracts).toEqual({
        total: 0,
        active: 0,
        draft: 0,
        suspended: 0,
        completed: 0,
        expiringSoon: 0,
      });
      expect(overview.invitations).toEqual({
        total: 0,
        pending: 0,
        accepted: 0,
        declined: 0,
        expired: 0,
      });
      expect(overview.recentActivity).toEqual([]);
      expect(overview.attention.items).toEqual([]);
      expect(overview.generatedAt).toBeDefined();
    });

    it('processes attention items for expiring contracts and urgent invitations', async () => {
      companyRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ total: '5', active: '5', inactive: '0', newThisMonth: '1' }),
      });

      userRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ total: '10', active: '8', inactive: '2', pendingVerification: '3', platformAdmins: '1' }),
      });

      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const expiringContract = {
        id: '01JCNT1111111111111111111',
        referenceNumber: 'CTR-EXP-001',
        title: 'Offshore Supply Agreement',
        endDate: futureDate,
        revisedEndDate: null,
      };

      const contractQuery = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ total: '2', active: '1', draft: '1', suspended: '0', completed: '0', expiringSoon: '1' }),
        getMany: vi.fn().mockResolvedValue([expiringContract]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(contractQuery);

      const urgentInvite = {
        id: '01JINV2222222222222222222',
        email: 'engineer@contractor.com',
        firstName: 'Jane',
        lastName: 'Smith',
        companyRole: 'Client Site Engineer',
        expiresAt: futureDate,
      };

      const inviteQuery = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ total: '1', pending: '1', accepted: '0', declined: '0', expired: '0' }),
        getMany: vi.fn().mockResolvedValue([urgentInvite]),
      };
      invitationRepo.createQueryBuilder.mockReturnValue(inviteQuery);

      const activityLog = {
        id: '01JACT3333333333333333333',
        action: 'company.registered',
        entityType: 'company',
        entityId: '01JCOMP444444444444444444',
        summary: 'New company onboarded: Delta Operations',
        actorUser: {
          user: { firstName: 'Alice', lastName: 'Admin' },
        },
        company: { name: 'Delta Operations' },
        occurredAt: new Date(),
      };

      activityLogRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([activityLog]),
      });

      const overview = await service.getOverview();

      expect(overview.companies.total).toBe(5);
      expect(overview.users.total).toBe(10);
      expect(overview.users.pendingVerification).toBe(3);
      expect(overview.contracts.expiringSoon).toBe(1);
      expect(overview.recentActivity).toHaveLength(1);
      expect(overview.recentActivity[0].actorName).toBe('Alice Admin');
      expect(overview.recentActivity[0].companyName).toBe('Delta Operations');

      expect(overview.attention.items.length).toBeGreaterThanOrEqual(3);
      const contractItem = overview.attention.items.find((i) => i.category === 'contract_expiry');
      expect(contractItem).toBeDefined();
      expect(contractItem?.title).toContain('CTR-EXP-001');

      const inviteItem = overview.attention.items.find((i) => i.category === 'invitation_pending');
      expect(inviteItem).toBeDefined();
      expect(inviteItem?.title).toContain('engineer@contractor.com');

      const userItem = overview.attention.items.find((i) => i.category === 'user_verification');
      expect(userItem).toBeDefined();
      expect(userItem?.description).toContain('3 registered user accounts');
    });
  });
});
