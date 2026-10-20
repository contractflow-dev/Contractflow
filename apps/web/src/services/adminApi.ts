import { api } from "./api";

export interface AdminCompanyMetrics {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

export interface AdminUserMetrics {
  total: number;
  active: number;
  inactive: number;
  pendingVerification: number;
  platformAdmins: number;
}

export interface AdminContractMetrics {
  total: number;
  active: number;
  draft: number;
  suspended: number;
  completed: number;
  expiringSoon: number;
}

export interface AdminInvitationMetrics {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
}

export interface AdminAttentionItem {
  id: string;
  category: "contract_expiry" | "invitation_pending" | "user_verification";
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  referenceDate?: string;
  actionUrl?: string;
}

export interface AdminAttentionSummary {
  expiringContractsCount: number;
  pendingInvitationsCount: number;
  unverifiedUsersCount: number;
  items: AdminAttentionItem[];
}

export interface AdminRecentActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorName: string;
  companyName: string | null;
  occurredAt: string;
}

export interface AdminOverviewResponse {
  companies: AdminCompanyMetrics;
  users: AdminUserMetrics;
  contracts: AdminContractMetrics;
  invitations: AdminInvitationMetrics;
  attention: AdminAttentionSummary;
  recentActivity: AdminRecentActivityItem[];
  generatedAt: string;
}

export const adminApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query<AdminOverviewResponse, void>({
      query: () => "/admin/overview",
      providesTags: ["Admin"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAdminOverviewQuery, useLazyGetAdminOverviewQuery } =
  adminApi;
