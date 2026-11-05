import { ECompanyStatus, ECountryCode, ECurrencyCode } from '@contractflow/contracts-schema';

export interface ICompanyEntity {
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
