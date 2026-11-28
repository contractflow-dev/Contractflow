import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { EStageHistoryEvent } from '@contractflow/contracts-schema';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { ContractStage } from './contract-stage.entity';

/**
 * One event in a stage's life: copied from the template, or a change of its
 * status, applicability, weight or dates. Written once, in the same
 * transaction as the change and its activity entry; the database refuses
 * updates (trigger contract_stage_history_immutable).
 */
@Entity('contract_stage_history')
export class ContractStageHistory extends BaseCustomEntity {
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

  @Column({ name: 'event_type', type: 'varchar', length: 30 })
  eventType!: EStageHistoryEvent;

  @Column({ name: 'from_status', type: 'varchar', length: 30, nullable: true })
  fromStatus!: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 30, nullable: true })
  toStatus!: string | null;

  @Column({ name: 'from_applicable', type: 'boolean', nullable: true })
  fromApplicable!: boolean | null;

  @Column({ name: 'to_applicable', type: 'boolean', nullable: true })
  toApplicable!: boolean | null;

  @Column({ name: 'from_weight_bps', type: 'int', nullable: true })
  fromWeightBps!: number | null;

  @Column({ name: 'to_weight_bps', type: 'int', nullable: true })
  toWeightBps!: number | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'actor_company_user_id', type: 'varchar', length: 26 })
  actorCompanyUserId!: string;
  @ManyToOne(() => CompanyUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_company_user_id', referencedColumnName: 'id' })
  actorCompanyUser!: CompanyUser;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
