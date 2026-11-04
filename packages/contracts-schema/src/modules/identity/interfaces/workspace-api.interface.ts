import type {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
} from "@contractflow/contracts-schema";
import type { ECountryCode, ECurrencyCode } from "../enums/identity.enum.js";

export interface IWorkspace {
  id: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  countryCode?: ECountryCode;
  defaultCurrencyCode?: ECurrencyCode;
  status: ECompanyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IWorkspaceMember {
  id: string;
  companyId: string;
  userId: string;
  companyRole: ECompanyRole;
  jobTitle?: string;
  status: ECompanyUserStatus;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ICreateWorkspaceRequest {
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  email?: string;
  phoneNumber?: string;
  countryCode?: ECountryCode;
  defaultCurrencyCode?: ECurrencyCode;
}

export interface IUpdateWorkspaceRequest {
  id: string;
  name?: string;
  legalName?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  addressLine1?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
}
