import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ECompanyStatus,
  EContractStatus,
  EInvitationStatus,
  EUserStatus,
} from '@contractflow/contracts-schema';
import type { Repository } from 'typeorm';
import { Company } from '../../identity/entities/company.entity';
import { AppUser } from '../../identity/entities/app-user.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { CompanyInvitation } from '../../identity/entities/company-invitation.entity';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import type {
  IAdminCompanyMetrics,
  IAdminContractMetrics,
  IAdminExpiringContract,
  IAdminInvitationMetrics,
  IAdminOverviewRepository,
  IAdminRecentActivity,
  IAdminUrgentInvitation,
  IAdminUserMetrics,
} from '../interfaces/admin-overview-repository.interface';

function metric(value: string | null | undefined): number {
  return Number(value ?? 0);
}

@Injectable()
export class AdminOverviewRepository implements IAdminOverviewRepository {
  constructor(
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(CompanyInvitation)
    private readonly invitations: Repository<CompanyInvitation>,
    @InjectRepository(ActivityLog)
    private readonly activityLogs: Repository<ActivityLog>,
  ) {}

  async getCompanyMetrics(since: Date): Promise<IAdminCompanyMetrics> {
    const raw = await this.companies
      .createQueryBuilder('company')
      .select('COUNT(*)', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE company.status = :activeStatus)',
        'active',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE company.status = :inactiveStatus)',
        'inactive',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE company.createdAt >= :since)',
        'newThisMonth',
      )
      .setParameters({
        activeStatus: ECompanyStatus.ACTIVE,
        inactiveStatus: ECompanyStatus.INACTIVE,
        since,
      })
      .getRawOne<Record<keyof IAdminCompanyMetrics, string>>();

    return {
      total: metric(raw?.total),
      active: metric(raw?.active),
      inactive: metric(raw?.inactive),
      newThisMonth: metric(raw?.newThisMonth),
    };
  }

  async getUserMetrics(): Promise<IAdminUserMetrics> {
    const raw = await this.users
      .createQueryBuilder('user')
      .select('COUNT(*)', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE user.status = :activeStatus)',
        'active',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE user.status = :inactiveStatus)',
        'inactive',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE user.emailVerifiedAt IS NULL)',
        'pendingVerification',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE user.isPlatformAdmin = true)',
        'platformAdmins',
      )
      .setParameters({
        activeStatus: EUserStatus.ACTIVE,
        inactiveStatus: EUserStatus.INACTIVE,
      })
      .getRawOne<Record<keyof IAdminUserMetrics, string>>();

    return {
      total: metric(raw?.total),
      active: metric(raw?.active),
      inactive: metric(raw?.inactive),
      pendingVerification: metric(raw?.pendingVerification),
      platformAdmins: metric(raw?.platformAdmins),
    };
  }

  async getContractMetrics(
    now: Date,
    thirtyDaysFromNow: Date,
  ): Promise<IAdminContractMetrics> {
    const raw = await this.contracts
      .createQueryBuilder('contract')
      .select('COUNT(*)', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE contract.status = :activeStatus)',
        'active',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE contract.status = :draftStatus)',
        'draft',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE contract.status = :suspendedStatus)',
        'suspended',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE contract.status = :completedStatus)',
        'completed',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE contract.status = :activeStatus AND COALESCE(contract.revisedEndDate, contract.endDate) BETWEEN :now AND :thirtyDaysFromNow)',
        'expiringSoon',
      )
      .setParameters({
        activeStatus: EContractStatus.ACTIVE,
        draftStatus: EContractStatus.DRAFT,
        suspendedStatus: EContractStatus.SUSPENDED,
        completedStatus: EContractStatus.COMPLETED,
        now,
        thirtyDaysFromNow,
      })
      .getRawOne<Record<keyof IAdminContractMetrics, string>>();

    return {
      total: metric(raw?.total),
      active: metric(raw?.active),
      draft: metric(raw?.draft),
      suspended: metric(raw?.suspended),
      completed: metric(raw?.completed),
      expiringSoon: metric(raw?.expiringSoon),
    };
  }

  async getInvitationMetrics(now: Date): Promise<IAdminInvitationMetrics> {
    const raw = await this.invitations
      .createQueryBuilder('invitation')
      .select('COUNT(*)', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE invitation.status = :pendingStatus)',
        'pending',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE invitation.status = :acceptedStatus)',
        'accepted',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE invitation.status = :declinedStatus)',
        'declined',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE invitation.status = :pendingStatus AND invitation.expiresAt < :now)',
        'expired',
      )
      .setParameters({
        pendingStatus: EInvitationStatus.PENDING,
        acceptedStatus: EInvitationStatus.ACCEPTED,
        declinedStatus: EInvitationStatus.DECLINED,
        now,
      })
      .getRawOne<Record<keyof IAdminInvitationMetrics, string>>();

    return {
      total: metric(raw?.total),
      pending: metric(raw?.pending),
      accepted: metric(raw?.accepted),
      declined: metric(raw?.declined),
      expired: metric(raw?.expired),
    };
  }

  findExpiringContracts(
    now: Date,
    thirtyDaysFromNow: Date,
  ): Promise<IAdminExpiringContract[]> {
    return this.contracts
      .createQueryBuilder('contract')
      .select([
        'contract.id AS id',
        'contract.referenceNumber AS "referenceNumber"',
        'contract.title AS title',
        'COALESCE(contract.revisedEndDate, contract.endDate) AS "endDate"',
      ])
      .where('contract.status = :activeStatus', {
        activeStatus: EContractStatus.ACTIVE,
      })
      .andWhere(
        'COALESCE(contract.revisedEndDate, contract.endDate) BETWEEN :now AND :thirtyDaysFromNow',
        { now, thirtyDaysFromNow },
      )
      .orderBy('COALESCE(contract.revisedEndDate, contract.endDate)', 'ASC')
      .limit(5)
      .getRawMany<IAdminExpiringContract>();
  }

  findUrgentInvitations(
    now: Date,
    sevenDaysFromNow: Date,
  ): Promise<IAdminUrgentInvitation[]> {
    return this.invitations
      .createQueryBuilder('invitation')
      .select([
        'invitation.id AS id',
        'invitation.email AS email',
        'invitation.firstName AS "firstName"',
        'invitation.lastName AS "lastName"',
        'invitation.companyRole AS "companyRole"',
        'invitation.expiresAt AS "expiresAt"',
      ])
      .where('invitation.status = :pendingStatus', {
        pendingStatus: EInvitationStatus.PENDING,
      })
      .andWhere('invitation.expiresAt <= :sevenDaysFromNow', {
        sevenDaysFromNow,
      })
      .orderBy('invitation.expiresAt', 'ASC')
      .limit(5)
      .getRawMany<IAdminUrgentInvitation>();
  }

  async findRecentActivity(): Promise<IAdminRecentActivity[]> {
    const logs = await this.activityLogs
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.company', 'company')
      .leftJoinAndSelect('log.actorUser', 'actorUser')
      .leftJoinAndSelect('actorUser.user', 'appUser')
      .orderBy('log.occurredAt', 'DESC')
      .limit(10)
      .getMany();

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      summary: log.summary,
      actorName: log.actorUser?.user
        ? `${log.actorUser.user.firstName} ${log.actorUser.user.lastName}`.trim() ||
          'Unknown Actor'
        : 'System',
      companyName: log.company?.name ?? null,
      occurredAt: log.occurredAt,
    }));
  }
}
