import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { ComplianceRequirement } from './compliance-requirement.entity';
import { ContractParty } from '../../contract/entities/contract-party.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { IComplianceRecordEntity } from '../interfaces/compliance-record.interface';
import { EComplianceRecordStatus } from '@contractflow/contracts-schema';

@Entity('compliance_record')
export class ComplianceRecord extends BaseCustomEntity implements IComplianceRecordEntity{
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'compliance_requirement_id', type: 'varchar', length: 26 })
  complianceRequirementId!: string;
  @ManyToOne(() => ComplianceRequirement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'compliance_requirement_id', referencedColumnName: 'id' })
  complianceRequirement!: ComplianceRequirement;

  @Column({ name: 'contract_party_id', type: 'varchar', length: 26 })
  contractPartyId!: string;
  @ManyToOne(() => ContractParty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_party_id', referencedColumnName: 'id' })
  ContractParty!: ContractParty;

  @Column({ name: 'reference_number', type: 'varchar', length: 100 })
  referenceNumber!: string;

  @Column({ name: 'issuing_authority', type: 'varchar', length: 255 })
  issuingAuthority!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: Date;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate!: Date;

  @Column({ name: 'covered_amount_minor', type: 'bigint' })
  coveredAmountMinor!: number;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @Column({ name: 'status', type: 'enum', enum: EComplianceRecordStatus })
  status!: EComplianceRecordStatus;

  @Column({ name: 'verified_at', type: 'timestamptz' })
  verifiedAt!: Date;

  @Column({ name: 'verified_by_id', type: 'varchar', length: 26 })
  verifiedById!: string;
  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verified_by_id', referencedColumnName: 'id' })
  verifiedBy!: CompanyUser;

  @Column({ name: 'remarks', type: 'text' })
  remarks!: string;
}
