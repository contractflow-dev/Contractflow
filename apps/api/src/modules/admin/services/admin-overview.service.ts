import { Inject, Injectable } from '@nestjs/common';
import {
  AdminAttentionItemDto,
  AdminOverviewResponseDto,
  AdminRecentActivityItemDto,
} from '../dto/admin-overview-response.dto';
import {
  ADMIN_OVERVIEW_REPOSITORY,
  type IAdminOverviewRepository,
} from '../interfaces/admin-overview-repository.interface';

@Injectable()
export class AdminOverviewService {
  constructor(
    @Inject(ADMIN_OVERVIEW_REPOSITORY)
    private readonly overview: IAdminOverviewRepository,
  ) {}

  async getOverview(): Promise<AdminOverviewResponseDto> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      companies,
      users,
      contracts,
      invitations,
      expiringContracts,
      urgentInvitations,
      activityRecords,
    ] = await Promise.all([
      this.overview.getCompanyMetrics(thirtyDaysAgo),
      this.overview.getUserMetrics(),
      this.overview.getContractMetrics(now, thirtyDaysFromNow),
      this.overview.getInvitationMetrics(now),
      this.overview.findExpiringContracts(now, thirtyDaysFromNow),
      this.overview.findUrgentInvitations(now, sevenDaysFromNow),
      this.overview.findRecentActivity(),
    ]);

    const attentionItems: AdminAttentionItemDto[] = [];
    for (const contract of expiringContracts) {
      const expiryDate = new Date(contract.endDate);
      const daysLeft = Math.max(
        0,
        Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      attentionItems.push({
        id: `contract-exp-${contract.id}`,
        category: 'contract_expiry',
        title: `Contract Expiring Soon: ${contract.referenceNumber}`,
        description: `"${contract.title}" expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        urgency: daysLeft <= 7 ? 'high' : 'medium',
        referenceDate: expiryDate.toISOString(),
      });
    }

    for (const invitation of urgentInvitations) {
      const expiresAt = new Date(invitation.expiresAt);
      const isPast = expiresAt.getTime() < now.getTime();
      attentionItems.push({
        id: `invite-urg-${invitation.id}`,
        category: 'invitation_pending',
        title: isPast
          ? `Expired Invitation: ${invitation.email}`
          : `Expiring Invitation: ${invitation.email}`,
        description: `Invitation for ${invitation.firstName} ${invitation.lastName} (${invitation.companyRole}) ${isPast ? 'has expired' : 'expires soon'}.`,
        urgency: isPast ? 'high' : 'medium',
        referenceDate: expiresAt.toISOString(),
      });
    }

    if (users.pendingVerification > 0) {
      attentionItems.push({
        id: 'unverified-users-summary',
        category: 'user_verification',
        title: 'Unverified User Accounts',
        description: `${users.pendingVerification} registered user account${users.pendingVerification === 1 ? '' : 's'} awaiting email verification.`,
        urgency: users.pendingVerification > 10 ? 'medium' : 'low',
      });
    }

    const recentActivity: AdminRecentActivityItemDto[] = activityRecords.map(
      (record) => {
        return {
          id: record.id,
          action: record.action,
          entityType: record.entityType,
          entityId: record.entityId,
          summary: record.summary,
          actorName: record.actorName,
          companyName: record.companyName,
          occurredAt: new Date(record.occurredAt).toISOString(),
        };
      },
    );

    return {
      companies,
      users,
      contracts,
      invitations,
      attention: {
        expiringContractsCount: contracts.expiringSoon,
        pendingInvitationsCount: invitations.pending,
        unverifiedUsersCount: users.pendingVerification,
        items: attentionItems,
      },
      recentActivity,
      generatedAt: now.toISOString(),
    };
  }
}
