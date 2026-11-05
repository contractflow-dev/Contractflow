import type {
  EContractSortField,
  EContractStatus,
  EPartyType,
  ESortOrder,
} from '@contractflow/contracts-schema';
import type { IPageQuery } from '../../../common/application/pagination.interface';

export interface ListContractsQuery extends IPageQuery {
  search?: string;
  status?: EContractStatus;
  includeDeleted?: boolean;
  sortBy?: EContractSortField;
  sortOrder?: ESortOrder;
}

export interface ListContractStatusHistoryQuery extends IPageQuery {
  fromDate?: string;
  toDate?: string;
  status?: EContractStatus;
  userId?: string;
}

export interface ContractPartySummary {
  id: string;
  companyId: string;
  companyName: string;
  partyType: EPartyType;
  signedAt: Date | null;
}
