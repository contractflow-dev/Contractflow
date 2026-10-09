import {
  Entity,
  Column,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { IComplianceRequirementEntity } from '../interfaces/compliance-requirement.interface';
import { EComplianceCategory, EAppliesToParty, EComplianceFrequency } from '@contractflow/contracts-schema';

@Entity('compliance_requirement')
export class ComplianceRequirement extends BaseCustomEntity implements IComplianceRequirementEntity{
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'category', type: 'enum', enum: EComplianceCategory })
  category!: EComplianceCategory;

  @Column({ name: 'applies_to_party_type', type: 'enum', enum: EAppliesToParty })
  appliesToPartyType!: EAppliesToParty;

  @Column({ name: 'is_mandatory', type: 'boolean' })
  isMandatory!: boolean;

  @Column({ name: 'frequency', type: 'enum', enum: EComplianceFrequency })
  frequency!: EComplianceFrequency;

  @Column({ name: 'first_due_date', type: 'date' })
  firstDueDate!: Date;
}
