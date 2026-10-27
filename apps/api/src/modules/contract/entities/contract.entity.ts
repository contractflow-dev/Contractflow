import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { IContractEntity } from '../interfaces/contract.interface';
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
} from '@contractflow/contracts-schema';
import { Company } from '../../identity/entities/company.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';

@Entity('contract')
export class Contract extends BaseCustomEntity implements IContractEntity {
  @Column({
    name: 'reference_number',
    type: 'varchar',
    length: 40,
    unique: true,
  })
  referenceNumber!: string;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'contract_type', type: 'enum', enum: EContractType })
  contractType!: EContractType;

  @Column({ name: 'status', type: 'enum', enum: EContractStatus })
  status!: EContractStatus;

  @Column({
    name: 'parent_contract_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  parentContractId!: string | null;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_contract_id', referencedColumnName: 'id' })
  parentContract!: Contract;

  @Column({ name: 'original_value_minor', type: 'bigint' })
  originalValueMinor!: string | number;

  @Column({ name: 'current_value_minor', type: 'bigint' })
  currentValueMinor!: string | number;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: ECurrencyCode;

  @Column({ name: 'retention_rate_bps', type: 'int' })
  retentionRateBps!: number;

  @Column({ name: 'advance_payment_rate_bps', type: 'int', nullable: true })
  advancePaymentRateBps!: number | null;

  @Column({ name: 'payment_terms_days', type: 'int' })
  paymentTermsDays!: number;

  @Column({
    name: 'liquidated_damages_per_day_minor',
    type: 'bigint',
    nullable: true,
  })
  liquidatedDamagesPerDayMinor!: string | number | null;

  @Column({ name: 'award_date', type: 'date' })
  awardDate!: Date;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: Date;

  @Column({ name: 'revised_end_date', type: 'date', nullable: true })
  revisedEndDate!: Date | null;

  @Column({ name: 'actual_completion_date', type: 'date', nullable: true })
  actualCompletionDate!: Date | null;

  @Column({ name: 'defects_liability_days', type: 'int' })
  defectsLiabilityDays!: number;

  @Column({ name: 'timezone', type: 'varchar', length: 64 })
  timezone!: string;

  @Column({
    name: 'created_by_company_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  createdByCompanyId!: string | null;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'created_by_company_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_contract_created_by_company',
  })
  createdByCompany!: Company | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({
    name: 'deleted_by_company_user_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  deletedByCompanyUserId!: string | null;

  @ManyToOne(() => CompanyUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'deleted_by_company_user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'fk_contract_deleted_by_company_user',
  })
  deletedByCompanyUser!: CompanyUser | null;
}
