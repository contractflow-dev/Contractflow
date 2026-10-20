export interface AdminCompanyMetricsDto {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

export interface AdminUserMetricsDto {
  total: number;
  active: number;
  inactive: number;
  pendingVerification: number;
  platformAdmins: number;
}

export interface AdminContractMetricsDto {
  total: number;
  active: number;
  draft: number;
  suspended: number;
  completed: number;
  expiringSoon: number;
}

export interface AdminInvitationMetricsDto {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
}

export interface AdminAttentionItemDto {
  id: string;
  category: 'contract_expiry' | 'invitation_pending' | 'user_verification';
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  referenceDate?: string;
  actionUrl?: string;
}

export interface AdminAttentionSummaryDto {
  expiringContractsCount: number;
  pendingInvitationsCount: number;
  unverifiedUsersCount: number;
  items: AdminAttentionItemDto[];
}

export interface AdminRecentActivityItemDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorName: string;
  companyName: string | null;
  occurredAt: string;
}

export class AdminOverviewResponseDto {
  companies!: AdminCompanyMetricsDto;
  users!: AdminUserMetricsDto;
  contracts!: AdminContractMetricsDto;
  invitations!: AdminInvitationMetricsDto;
  attention!: AdminAttentionSummaryDto;
  recentActivity!: AdminRecentActivityItemDto[];
  generatedAt!: string;
}
