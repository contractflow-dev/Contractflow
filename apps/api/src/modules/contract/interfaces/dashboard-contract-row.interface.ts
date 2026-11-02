import type { EContractStatus } from '@contractflow/contracts-schema';

export interface DashboardContractRow {
  id: string;
  referenceNumber: string;
  title: string;
  status: EContractStatus;
  endDate: Date | string | null;
  updatedAt: Date | string;
}
