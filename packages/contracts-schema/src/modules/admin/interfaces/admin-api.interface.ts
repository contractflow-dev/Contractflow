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

export interface IAdminAttentionItem {
  id: string;
  category: "contract_expiry" | "invitation_pending" | "user_verification";
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  referenceDate?: string;
  actionUrl?: string;
}

export interface IAdminAttentionSummary {
  expiringContractsCount: number;
  pendingInvitationsCount: number;
  unverifiedUsersCount: number;
  items: IAdminAttentionItem[];
}

export interface IAdminRecentActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorName: string;
  companyName: string | null;
  occurredAt: string;
}

export interface IAdminOverviewResponse {
  companies: IAdminCompanyMetrics;
  users: IAdminUserMetrics;
  contracts: IAdminContractMetrics;
  invitations: IAdminInvitationMetrics;
  attention: IAdminAttentionSummary;
  recentActivity: IAdminRecentActivityItem[];
  generatedAt: string;
}
