import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../identity/entities/company.entity';
import { AppUser } from '../../identity/entities/app-user.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { CompanyInvitation } from '../../identity/entities/company-invitation.entity';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import {
  ECompanyStatus,
  EContractStatus,
  EInvitationStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import {
  AdminAttentionItemDto,
  AdminOverviewResponseDto,
  AdminRecentActivityItemDto,
} from '../dto/admin-overview-response.dto';

@Injectable()
export class AdminOverviewService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(AppUser)
    private readonly userRepo: Repository<AppUser>,
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(CompanyInvitation)
    private readonly invitationRepo: Repository<CompanyInvitation>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
  ) {}

  async getOverview(): Promise<AdminOverviewResponseDto> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Company metrics (database aggregation)
    const rawCompany = await this.companyRepo
      .createQueryBuilder('c')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE c.status = :activeStatus)`,
        'active',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE c.status = :inactiveStatus)`,
        'inactive',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE c.createdAt >= :thirtyDaysAgo)`,
        'newThisMonth',
      )
      .setParameter('activeStatus', ECompanyStatus.ACTIVE)
      .setParameter('inactiveStatus', ECompanyStatus.INACTIVE)
      .setParameter('thirtyDaysAgo', thirtyDaysAgo)
      .getRawOne<{
        total: string;
        active: string;
        inactive: string;
        newThisMonth: string;
      }>();

    // 2. User metrics (database aggregation)
    const rawUser = await this.userRepo
      .createQueryBuilder('u')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE u.status = :activeStatus)`,
        'active',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE u.status = :inactiveStatus)`,
        'inactive',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE u.emailVerifiedAt IS NULL)`,
        'pendingVerification',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE u.isPlatformAdmin = true)`,
        'platformAdmins',
      )
      .setParameter('activeStatus', EUserStatus.ACTIVE)
      .setParameter('inactiveStatus', EUserStatus.INACTIVE)
      .getRawOne<{
        total: string;
        active: string;
        inactive: string;
        pendingVerification: string;
        platformAdmins: string;
      }>();

    // 3. Contract metrics (database aggregation)
    const rawContract = await this.contractRepo
      .createQueryBuilder('cnt')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE cnt.status = :activeStatus)`,
        'active',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE cnt.status = :draftStatus)`,
        'draft',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE cnt.status = :suspendedStatus)`,
        'suspended',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE cnt.status = :completedStatus)`,
        'completed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE cnt.status = :activeStatus AND (COALESCE(cnt.revisedEndDate, cnt.endDate) BETWEEN :now AND :thirtyDaysFromNow))`,
        'expiringSoon',
      )
      .setParameter('activeStatus', EContractStatus.ACTIVE)
      .setParameter('draftStatus', EContractStatus.DRAFT)
      .setParameter('suspendedStatus', EContractStatus.SUSPENDED)
      .setParameter('completedStatus', EContractStatus.COMPLETED)
      .setParameter('now', now)
      .setParameter('thirtyDaysFromNow', thirtyDaysFromNow)
      .getRawOne<{
        total: string;
        active: string;
        draft: string;
        suspended: string;
        completed: string;
        expiringSoon: string;
      }>();

    // 4. Invitation metrics (database aggregation)
    const rawInvitation = await this.invitationRepo
      .createQueryBuilder('inv')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE inv.status = :pendingStatus)`,
        'pending',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE inv.status = :acceptedStatus)`,
        'accepted',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE inv.status = :declinedStatus)`,
        'declined',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE inv.status = :pendingStatus AND inv.expiresAt < :now)`,
        'expired',
      )
      .setParameter('pendingStatus', EInvitationStatus.PENDING)
      .setParameter('acceptedStatus', EInvitationStatus.ACCEPTED)
      .setParameter('declinedStatus', EInvitationStatus.DECLINED)
      .setParameter('now', now)
      .getRawOne<{
        total: string;
        pending: string;
        accepted: string;
        declined: string;
        expired: string;
      }>();

    // 5. Attention Items (Expiring contracts, urgent pending invitations, unverified users)
    const attentionItems: AdminAttentionItemDto[] = [];

    const expiringContracts = await this.contractRepo
      .createQueryBuilder('cnt')
      .where('cnt.status = :activeStatus', {
        activeStatus: EContractStatus.ACTIVE,
      })
      .andWhere(
        'COALESCE(cnt.revisedEndDate, cnt.endDate) BETWEEN :now AND :thirtyDaysFromNow',
        { now, thirtyDaysFromNow },
      )
      .orderBy('COALESCE(cnt.revisedEndDate, cnt.endDate)', 'ASC')
      .limit(5)
      .getMany();

    for (const contract of expiringContracts) {
      const expiryDate = contract.revisedEndDate ?? contract.endDate;
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );

      attentionItems.push({
        id: `contract-exp-${contract.id}`,
        category: 'contract_expiry',
        title: `Contract Expiring Soon: ${contract.referenceNumber}`,
        description: `"${contract.title}" expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        urgency: daysLeft <= 7 ? 'high' : 'medium',
        referenceDate: new Date(expiryDate).toISOString(),
      });
    }

    const urgentInvitations = await this.invitationRepo
      .createQueryBuilder('inv')
      .where('inv.status = :pendingStatus', {
        pendingStatus: EInvitationStatus.PENDING,
      })
      .andWhere('inv.expiresAt <= :sevenDaysFromNow', { sevenDaysFromNow })
      .orderBy('inv.expiresAt', 'ASC')
      .limit(5)
      .getMany();

    for (const invite of urgentInvitations) {
      const isPast = new Date(invite.expiresAt).getTime() < now.getTime();
      attentionItems.push({
        id: `invite-urg-${invite.id}`,
        category: 'invitation_pending',
        title: isPast
          ? `Expired Invitation: ${invite.email}`
          : `Expiring Invitation: ${invite.email}`,
        description: `Invitation for ${invite.firstName} ${invite.lastName} (${invite.companyRole}) ${isPast ? 'has expired' : 'expires soon'}.`,
        urgency: isPast ? 'high' : 'medium',
        referenceDate: new Date(invite.expiresAt).toISOString(),
      });
    }

    const unverifiedUsersCount = Number(rawUser?.pendingVerification ?? 0);
    if (unverifiedUsersCount > 0) {
      attentionItems.push({
        id: 'unverified-users-summary',
        category: 'user_verification',
        title: 'Unverified User Accounts',
        description: `${unverifiedUsersCount} registered user account${unverifiedUsersCount === 1 ? '' : 's'} awaiting email verification.`,
        urgency: unverifiedUsersCount > 10 ? 'medium' : 'low',
      });
    }

    // 6. Recent Activity
    const recentActivityRecords = await this.activityLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.company', 'company')
      .leftJoinAndSelect('log.actorUser', 'actorUser')
      .leftJoinAndSelect('actorUser.user', 'appUser')
      .orderBy('log.occurredAt', 'DESC')
      .limit(10)
      .getMany();

    const recentActivity: AdminRecentActivityItemDto[] = recentActivityRecords.map(
      (log) => {
        let actorName = 'System';
        if (log.actorUser?.user) {
          actorName = `${log.actorUser.user.firstName} ${log.actorUser.user.lastName}`.trim();
        }

        return {
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          summary: log.summary,
          actorName: actorName || 'Unknown Actor',
          companyName: log.company?.name ?? null,
          occurredAt: new Date(log.occurredAt).toISOString(),
        };
      },
    );

    return {
      companies: {
        total: Number(rawCompany?.total ?? 0),
        active: Number(rawCompany?.active ?? 0),
        inactive: Number(rawCompany?.inactive ?? 0),
        newThisMonth: Number(rawCompany?.newThisMonth ?? 0),
      },
      users: {
        total: Number(rawUser?.total ?? 0),
        active: Number(rawUser?.active ?? 0),
        inactive: Number(rawUser?.inactive ?? 0),
        pendingVerification: unverifiedUsersCount,
        platformAdmins: Number(rawUser?.platformAdmins ?? 0),
      },
      contracts: {
        total: Number(rawContract?.total ?? 0),
        active: Number(rawContract?.active ?? 0),
        draft: Number(rawContract?.draft ?? 0),
        suspended: Number(rawContract?.suspended ?? 0),
        completed: Number(rawContract?.completed ?? 0),
        expiringSoon: Number(rawContract?.expiringSoon ?? 0),
      },
      invitations: {
        total: Number(rawInvitation?.total ?? 0),
        pending: Number(rawInvitation?.pending ?? 0),
        accepted: Number(rawInvitation?.accepted ?? 0),
        declined: Number(rawInvitation?.declined ?? 0),
        expired: Number(rawInvitation?.expired ?? 0),
      },
      attention: {
        expiringContractsCount: Number(rawContract?.expiringSoon ?? 0),
        pendingInvitationsCount: Number(rawInvitation?.pending ?? 0),
        unverifiedUsersCount,
        items: attentionItems,
      },
      recentActivity,
      generatedAt: now.toISOString(),
    };
  }
}
