export const ADMIN_OVERVIEW_REPOSITORY = Symbol('ADMIN_OVERVIEW_REPOSITORY');

export interface IAdminCompanyMetrics {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

export interface IAdminUserMetrics {
  total: number;
  active: number;
  inactive: number;
  pendingVerification: number;
  platformAdmins: number;
}

export interface IAdminContractMetrics {
  total: number;
  active: number;
  draft: number;
  suspended: number;
  completed: number;
  expiringSoon: number;
}

export interface IAdminInvitationMetrics {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
}

export interface IAdminExpiringContract {
  id: string;
  referenceNumber: string;
  title: string;
  endDate: Date | string;
}

export interface IAdminUrgentInvitation {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyRole: string;
  expiresAt: Date | string;
}

export interface IAdminRecentActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorName: string;
  companyName: string | null;
  occurredAt: Date | string;
}

export interface IAdminOverviewRepository {
  getCompanyMetrics(since: Date): Promise<IAdminCompanyMetrics>;
  getUserMetrics(): Promise<IAdminUserMetrics>;
  getContractMetrics(
    now: Date,
    thirtyDaysFromNow: Date,
  ): Promise<IAdminContractMetrics>;
  getInvitationMetrics(now: Date): Promise<IAdminInvitationMetrics>;
  findExpiringContracts(
    now: Date,
    thirtyDaysFromNow: Date,
  ): Promise<IAdminExpiringContract[]>;
  findUrgentInvitations(
    now: Date,
    sevenDaysFromNow: Date,
  ): Promise<IAdminUrgentInvitation[]>;
  findRecentActivity(): Promise<IAdminRecentActivity[]>;
}
