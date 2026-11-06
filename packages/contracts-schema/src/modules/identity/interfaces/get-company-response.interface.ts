import {
  EContractStatus,
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  ECurrencyCode,
  ECountryCode,
  EInvitationRole,
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
  companyRole: EInvitationRole;
  status: EInvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface IInviteCompanyMemberRequest {
  email: string;
  companyRole: EInvitationRole;
}

export type ICreateCompanyRequest = Omit<
  ICompanyProfileResponse,
  "id" | "status" | "verifiedAt"
>;

export type IUpdateCompanyProfileRequest = Partial<ICreateCompanyRequest>;

export interface IPublicCompanyInvitation {
  companyName: string;
  email: string;
  companyRole: EInvitationRole;
  expiresAt: string;
}

export interface ICompanyInvitationResponseRequest {
  token: string;
  decision: "accept" | "decline";
}

export interface ICompanyInvitationResponseResult {
  status: EInvitationStatus;
}
