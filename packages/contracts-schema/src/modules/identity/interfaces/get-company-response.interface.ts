import {
  EContractStatus,
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  ECurrencyCode,
  ECountryCode,
  EInvitationStatus,
} from "@contractflow/contracts-schema";

export interface ICompanyResponseDto {
  id: string;
  name: string;
  legalName: string;
  registrationNumber: string;
  taxIdentificationNumber: string;
  email: string;
  phoneNumber: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: ECountryCode;
  defaultCurrencyCode: ECurrencyCode;
  status: ECompanyStatus;
  verifiedAt: Date | null;
}
export interface ICompanyProfileResponse {
  id: string;
  name: string;
  legalName: string;
  registrationNumber: string;
  taxIdentificationNumber: string;
  email: string;
  phoneNumber: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  countryCode: ECountryCode;
  defaultCurrencyCode: ECurrencyCode;
  status: ECompanyStatus;
  /** When the company email was verified; null until then. */
  verifiedAt: Date | null;
}

export interface ICompanyMembershipResponse {
  id: string;
  companyId: string;
  companyRole: ECompanyRole;
  status: ECompanyUserStatus;
  canManageCompany: boolean;
}

export interface ICompanyAccessResponse {
  company: ICompanyProfileResponse;
  membership: ICompanyMembershipResponse;
}

/**
 * Why the current user does or doesn't have company access. Lets the web app
 * tell a new user (send to company setup) from one whose access has ended.
 * Contains no company names or IDs.
 */
export interface ICompanyAccessSummaryResponse {
  /** Active memberships of active companies (what GET /companies lists). */
  activeCompanyCount: number;
  /** The user was removed from, or left, at least one company. */
  hasEndedMembership: boolean;
  /** The user is still a member of at least one company that is inactive. */
  hasInactiveCompanyMembership: boolean;
  /**
   * Pending, unexpired invitations from active companies to the user's
   * verified email address. Zero while the email is unverified.
   */
  pendingInvitationCount: number;
}

/**
 * What is holding progress up across the company's own contracts that are
 * not archived. Counts only: every figure comes from recorded data, so it is
 * 0 until the related records exist.
 */
export interface ICompanyPortfolioHealth {
  /** A contract counts as stalled after this many days without a change. */
  stalledAfterDays: number;
  /** Active contracts with no status change, update or milestone update. */
  stalledContractCount: number;
  /** Contractor companies with an expired, rejected or non-compliant record. */
  nonCompliantContractorCount: number;
  /** Unpaid invoices past their due date that the company issued or owes. */
  overduePaymentCount: number;
}

/** One figure per department workspace, each through its own lens. */
export interface ICompanyDepartmentSummary {
  /** Contractor: compliance records that are expired, due or rejected. */
  complianceAttentionCount: number;
  /** Client project management: suspended, stalled or ending soon. */
  contractsNeedingAttentionCount: number;
  /** HSE: incidents not yet closed. */
  openIncidentCount: number;
  /** Finance: unpaid invoices due within `dueWindowDays`. */
  invoicesDueSoonCount: number;
  dueWindowDays: number;
}

export interface ICompanyDashboardResponse extends ICompanyAccessResponse {
  expiryWindowDays: number;
  summary: {
    activeMembershipCount: number;
    pendingInvitationCount: number;
    totalContractCount: number;
    activeContractCount: number;
    expiringContractCount: number;
  };
  portfolioHealth: ICompanyPortfolioHealth;
  departments: ICompanyDepartmentSummary;
  expiringContracts: ICompanyDashboardContractResponse[];
  recentlyUpdatedContracts: ICompanyDashboardContractResponse[];
}

export interface ICompanyDashboardContractResponse {
  id: string;
  referenceNumber: string;
  title: string;
  status: EContractStatus;
  endDate: string | null;
  updatedAt: string;
}

export interface ICompanyMembership {
  id: string;
  companyId: string;
  companyRole: string;
  status: string;
  canManageCompany: boolean;
}

export interface ICompanyDashboard extends ICompanyAccessResponse {
  expiryWindowDays: number;
  summary: {
    activeMembershipCount: number;
    pendingInvitationCount: number;
    totalContractCount: number;
    activeContractCount: number;
    expiringContractCount: number;
  };
  portfolioHealth: ICompanyPortfolioHealth;
  departments: ICompanyDepartmentSummary;
  expiringContracts: ICompanyDashboardContract[];
  recentlyUpdatedContracts: ICompanyDashboardContract[];
}

export interface ICompanyDashboardContract {
  id: string;
  referenceNumber: string;
  title: string;
  status: EContractStatus;
  endDate: string | null;
  updatedAt: string;
}

export interface ICreateCompanyResponse extends ICompanyAccessResponse {
  message?: string;
}

export interface ICompanyMember {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyRole: ECompanyRole;
  status: ECompanyUserStatus;
  joinedAt: string;
  leftAt: string | null;
}

export interface ICompanyInvitation {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyRole: ECompanyRole;
  status: EInvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

/**
 * A company team invitation: company membership only. It never carries a
 * contract role; those are assigned per contract after the person joins.
 */
export interface IInviteCompanyMemberRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  companyRole: ECompanyRole;
}

export type ICreateCompanyRequest = Omit<
  ICompanyProfileResponse,
  "id" | "status" | "verifiedAt"
>;

export type IUpdateCompanyProfileRequest = Partial<ICreateCompanyRequest>;

/** What the invitee sees about a pending company invitation. */
export interface ICompanyInvitationDetails {
  companyName: string;
  /** The inviting administrator's name, when known. */
  inviterName: string | null;
  email: string;
  companyRole: ECompanyRole;
  expiresAt: string;
}

/**
 * The preview of an invitation link. Only a pending invitation carries its
 * details; an answered, expired or revoked one reports only its status.
 */
export type IPublicCompanyInvitation =
  | ({ status: EInvitationStatus.PENDING } & ICompanyInvitationDetails)
  | {
      status: Exclude<EInvitationStatus, EInvitationStatus.PENDING>;
    };

/** A pending invitation to the signed-in user's verified email address. */
export interface IMyCompanyInvitation extends ICompanyInvitationDetails {
  id: string;
}

export type CompanyInvitationDecision = "accept" | "decline";

export interface ICompanyInvitationResponseRequest {
  token: string;
  decision: CompanyInvitationDecision;
}

/** Answers one of the signed-in user's own invitations, by its ID. */
export interface IMyCompanyInvitationResponseRequest {
  invitationId: string;
  decision: CompanyInvitationDecision;
}

export interface ICompanyInvitationResponseResult {
  status: EInvitationStatus;
  /** The company joined, when the invitation was accepted. */
  companyId?: string;
}
