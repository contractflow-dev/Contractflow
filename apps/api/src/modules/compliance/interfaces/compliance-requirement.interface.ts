import {
  EAppliesToParty,
  EComplianceCategory,
  EComplianceFrequency,
} from '@contractflow/contracts-schema';

export interface IComplianceRequirementEntity {
  contractId: string;
  name: string;
  description: string;
  category: EComplianceCategory;
  appliesToPartyType: EAppliesToParty;
  isMandatory: boolean;
  frequency: EComplianceFrequency;
  firstDueDate: Date;
}