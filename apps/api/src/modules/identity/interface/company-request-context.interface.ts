import type {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';

export interface ICompanyRequestContext {
  companyId: string;
  companyStatus: ECompanyStatus;
  membership: {
    id: string;
    companyId: string;
    companyRole: ECompanyRole;
    status: ECompanyUserStatus;
  };
}
