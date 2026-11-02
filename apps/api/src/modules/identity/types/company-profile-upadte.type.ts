import { Company } from '../entities/company.entity';
/**
 * Only fields that are allowed to be updated through
 * the company profile workflow.
 *
 * System-managed fields such as status and verifiedAt
 * are deliberately excluded.
 */

export type CompanyProfileUpdateData = Partial<
  Pick<
    Company,
    | 'name'
    | 'legalName'
    | 'email'
    | 'phoneNumber'
    | 'website'
    | 'addressLine1'
    | 'addressLine2'
    | 'city'
    | 'stateRegion'
    | 'postalCode'
    | 'countryCode'
    | 'defaultCurrencyCode'
  >
>;
