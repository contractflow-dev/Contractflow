import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EStatus } from '@contractflow/contracts-schema';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
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
}
