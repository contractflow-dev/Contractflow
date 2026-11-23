import type { EStatus } from '@contractflow/contracts-schema';

export interface IContractStageEntity {
  contractId: string;
  name: string;
  description: string | null;
  sequence: number;
  status: EStatus;
  weightBps: number;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
}
