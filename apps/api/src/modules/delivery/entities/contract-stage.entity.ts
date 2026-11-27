import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
  EStatus,
  type ELifecycleStageCode,
} from '@contractflow/contracts-schema';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { LifecycleTemplateStage } from './lifecycle-template-stage.entity';
import { IContractStageEntity } from '../interface/contract-stage.interface';

@Entity('contract_stage')
export class ContractStage
  extends BaseCustomEntity
  implements IContractStageEntity
{
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;

  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'sequence', type: 'int' })
  sequence!: number;

  @Column({ name: 'status', type: 'enum', enum: EStatus })
  status!: EStatus;

  /** Share of the contract, in basis points. */
  @Column({ name: 'weight_bps', type: 'int' })
  weightBps!: number;

  @Column({ name: 'planned_start_date', type: 'date' })
  plannedStartDate!: string;

  @Column({ name: 'planned_end_date', type: 'date' })
  plannedEndDate!: string;

  @Column({ name: 'actual_start_date', type: 'date', nullable: true })
  actualStartDate!: string | null;

  @Column({ name: 'actual_end_date', type: 'date', nullable: true })
  actualEndDate!: string | null;

  /** The lifecycle stage it was copied from; null for custom or older stages. */
  @Column({ name: 'stage_code', type: 'varchar', length: 40, nullable: true })
  stageCode!: ELifecycleStageCode | null;

  @Column({
    name: 'template_stage_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  templateStageId!: string | null;
  @ManyToOne(() => LifecycleTemplateStage, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'template_stage_id', referencedColumnName: 'id' })
  templateStage!: LifecycleTemplateStage | null;

  /** Whether the stage applies to this contract (decision D-7). */
  @Column({ name: 'is_applicable', type: 'boolean', default: true })
  isApplicable!: boolean;

  /** Why the stage doesn't apply; required when it doesn't. */
  @Column({ name: 'applicability_reason', type: 'text', nullable: true })
  applicabilityReason!: string | null;

  @Column({
    name: 'applicability_decided_by_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  applicabilityDecidedById!: string | null;

  @Column({
    name: 'applicability_decided_at',
    type: 'timestamptz',
    nullable: true,
  })
  applicabilityDecidedAt!: Date | null;
}
