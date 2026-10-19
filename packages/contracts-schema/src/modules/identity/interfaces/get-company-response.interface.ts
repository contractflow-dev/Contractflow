import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  ECurrencyCode,
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
  countryCode: string;
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
  countryCode: string;
  defaultCurrencyCode: ECurrencyCode;
  status: ECompanyStatus;
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

export interface ICompanyDashboardResponse extends ICompanyAccessResponse {
  summary: {
    activeMembershipCount: number;
    pendingInvitationCount: number;
    activeContractCount: number;
    expiringContractCount: number;
  };
}
