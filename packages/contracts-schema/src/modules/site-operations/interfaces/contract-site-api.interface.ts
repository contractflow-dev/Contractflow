import { ECountryCode } from "../../identity/index.js";
import type { EContractSiteStatus } from "../enums/site-operations.enum.js";

/** Coordinates are stored as integer micro-degrees (degrees × 1,000,000). */
export interface ContractSite {
  id: string;
  contractId: string;
  name: string;
  siteCode: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  countryCode: ECountryCode;
  latitudeE6: number;
  longitudeE6: number;
  status: EContractSiteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractSiteRequest {
  name: string;
  siteCode: string;
  addressLine1: string;
  city: string;
  stateRegion: string;
  countryCode: ECountryCode;
  latitudeE6: number;
  longitudeE6: number;
  status: EContractSiteStatus;
}

export type UpdateContractSiteRequest = Partial<CreateContractSiteRequest>;
