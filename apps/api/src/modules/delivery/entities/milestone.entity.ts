import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
  EMilestoneStatus,
  ECurrencyCode,
} from '@contractflow/contracts-schema';
import { Contract } from '../../contract/entities/contract.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { IMilestoneEntity } from '../interface/milestone.interface';
import { ContractStage } from './contract-stage.entity';

/**
 * A milestone's current state. Its submissions, decisions and outstanding
 * work are kept in their own history tables; the `submitted_*`, `approved_*`
 * and `rejection_reason` columns hold only the latest of each.
 */
@Entity('milestone')
export class Milestone extends BaseCustomEntity implements IMilestoneEntity {
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'contract_stage_id', type: 'varchar', length: 26 })
  contractStageId!: string;
  @ManyToOne(() => ContractStage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_stage_id', referencedColumnName: 'id' })
  contractStage!: ContractStage;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'acceptance_criteria', type: 'text', nullable: true })
  acceptanceCriteria!: string | null;

  @Column({ name: 'deliverables', type: 'text', nullable: true })
  deliverables!: string | null;

  @Column({ name: 'sequence', type: 'int' })
  sequence!: number;

  @Column({ name: 'status', type: 'enum', enum: EMilestoneStatus })
  status!: EMilestoneStatus;

  /** Completion the contractor reported with its latest submission. */
  @Column({ name: 'progress_bps', type: 'int' })
  progressBps!: number;

  /** Share of the milestone the client has accepted so far. */
  @Column({ name: 'approved_bps', type: 'int', default: 0 })
  approvedBps!: number;

  /** Share of its stage. */
  @Column({ name: 'weight_bps', type: 'int' })
  weightBps!: number;

  @Column({ name: 'target_quantity', type: 'int', nullable: true })
  targetQuantity!: number | null;

  @Column({
    name: 'quantity_unit',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  quantityUnit!: string | null;

  @Column({ name: 'approved_quantity', type: 'int', nullable: true })
  approvedQuantity!: number | null;

  @Column({ name: 'is_payment_milestone', type: 'boolean' })
  isPaymentMilestone!: boolean;

  @Column({ name: 'amount_minor', type: 'bigint', nullable: true })
  amountMinor!: string | null;

  @Column({ name: 'currency_code', type: 'char', length: 3, nullable: true })
  currencyCode!: ECurrencyCode | null;

  @Column({ name: 'planned_start_date', type: 'date', nullable: true })
  plannedStartDate!: string | null;

  @Column({ name: 'actual_start_date', type: 'date', nullable: true })
  actualStartDate!: string | null;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ name: 'revised_due_date', type: 'date', nullable: true })
  revisedDueDate!: string | null;

  /** The day the milestone was fully approved. */
  @Column({ name: 'completed_date', type: 'date', nullable: true })
  completedDate!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({
    name: 'submitted_by_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  submittedById!: string | null;
  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submitted_by_id', referencedColumnName: 'id' })
  submittedBy!: CompanyUser | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({
    name: 'approved_by_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  approvedById!: string | null;
  @ManyToOne(() => CompanyUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approved_by_id', referencedColumnName: 'id' })
  approvedBy!: CompanyUser | null;

  /**
   * The status a legacy milestone had before the controlled transition moved
   * it into the workflow; null for every other milestone.
   */
  @Column({
    name: 'legacy_status',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  legacyStatus!: string | null;

  /** The latest rejection's reason; each one is kept in `milestone_decision`. */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;
}
