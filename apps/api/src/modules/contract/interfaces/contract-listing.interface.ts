import type {
  EContractStatus,
  EPartyType,
} from '@contractflow/contracts-schema';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PageQuery {
  page: number;
  limit: number;
}

export interface ListContractsQuery extends PageQuery {
  search?: string;
  status?: EContractStatus;
  includeDeleted?: boolean;
}

export interface ListContractStatusHistoryQuery extends PageQuery {
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
