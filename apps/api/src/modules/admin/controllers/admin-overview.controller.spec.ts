import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAdminOverviewRepository } from '../interfaces/admin-overview-repository.interface';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminOverviewService } from '../services/admin-overview.service';

describe('AdminOverviewController and AdminOverviewService', () => {
  let controller: AdminOverviewController;
  let service: AdminOverviewService;
  let overview: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    overview = {
      getCompanyMetrics: vi.fn().mockResolvedValue({
        total: 10,
        active: 8,
        inactive: 2,
        newThisMonth: 3,
      }),
      getUserMetrics: vi.fn().mockResolvedValue({
        total: 45,
        active: 40,
        inactive: 5,
        pendingVerification: 4,
        platformAdmins: 2,
      }),
      getContractMetrics: vi.fn().mockResolvedValue({
        total: 15,
        active: 10,
        draft: 3,
        suspended: 1,
        completed: 1,
        expiringSoon: 2,
      }),
      getInvitationMetrics: vi.fn().mockResolvedValue({
        total: 20,
        pending: 5,
        accepted: 12,
        declined: 3,
        expired: 1,
      }),
      findExpiringContracts: vi.fn().mockResolvedValue([]),
      findUrgentInvitations: vi.fn().mockResolvedValue([]),
      findRecentActivity: vi.fn().mockResolvedValue([]),
    };

    service = new AdminOverviewService(
      overview as unknown as IAdminOverviewRepository,
    );
    controller = new AdminOverviewController(service);
  });

  it('returns overview data from the service', async () => {
    const result = await controller.getOverview();

    expect(result.companies.total).toBe(10);
    expect(result.users.total).toBe(45);
    expect(result.contracts.active).toBe(10);
    expect(result.invitations.pending).toBe(5);
  });

  it('loads aggregate and recent records through the persistence port', async () => {
    const overviewResponse = await service.getOverview();

    expect(overviewResponse).toMatchObject({
      companies: { total: 10, active: 8, inactive: 2, newThisMonth: 3 },
      users: {
        total: 45,
        active: 40,
        inactive: 5,
        pendingVerification: 4,
        platformAdmins: 2,
      },
      contracts: {
        total: 15,
        active: 10,
        draft: 3,
        suspended: 1,
        completed: 1,
        expiringSoon: 2,
      },
      invitations: {
        total: 20,
        pending: 5,
        accepted: 12,
        declined: 3,
        expired: 1,
      },
      attention: {
        expiringContractsCount: 2,
        pendingInvitationsCount: 5,
        unverifiedUsersCount: 4,
      },
    });
    expect(overview.getCompanyMetrics).toHaveBeenCalledWith(expect.any(Date));
    expect(overview.getContractMetrics).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
    );
    expect(overview.getInvitationMetrics).toHaveBeenCalledWith(
      expect.any(Date),
    );
    expect(overview.findRecentActivity).toHaveBeenCalledOnce();
    expect(overviewResponse.generatedAt).toBeDefined();
  });

  it('creates attention items for expiring contracts, invitations, and unverified users', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    overview.findExpiringContracts.mockResolvedValue([
      {
        id: 'contract-1',
        referenceNumber: 'CTR-EXP-001',
        title: 'Bridge works',
        endDate: futureDate,
      },
    ]);
    overview.findUrgentInvitations.mockResolvedValue([
      {
        id: 'invitation-1',
        email: 'member@example.com',
        firstName: 'Member',
        lastName: 'Person',
        companyRole: 'Site Engineer',
        expiresAt: expiredDate,
      },
    ]);
    overview.findRecentActivity.mockResolvedValue([
      {
        id: 'activity-1',
        action: 'contract.created',
        entityType: 'contract',
        entityId: 'contract-1',
        summary: 'Contract created',
        actorName: 'Jane Doe',
        companyName: 'Acme',
        occurredAt: futureDate,
      },
    ]);

    const result = await service.getOverview();

    expect(result.attention.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'contract-exp-contract-1',
          category: 'contract_expiry',
          urgency: 'high',
        }),
        expect.objectContaining({
          id: 'invite-urg-invitation-1',
          category: 'invitation_pending',
          title: 'Expired Invitation: member@example.com',
          urgency: 'high',
        }),
        expect.objectContaining({
          id: 'unverified-users-summary',
          category: 'user_verification',
          urgency: 'low',
        }),
      ]),
    );
    expect(result.recentActivity).toEqual([
      expect.objectContaining({
        id: 'activity-1',
        actorName: 'Jane Doe',
        companyName: 'Acme',
      }),
    ]);
  });
});
