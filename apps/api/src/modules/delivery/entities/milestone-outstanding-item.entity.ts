import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { MilestoneDecision } from './milestone-decision.entity';
import { Milestone } from './milestone.entity';

/**
 * Work a partial approval left open. Accepted at most once, by a later
 * decision; the acceptance is the only change ever made to the row.
 */
@Entity('milestone_outstanding_item')
export class MilestoneOutstandingItem extends BaseCustomEntity {
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'milestone_id', type: 'varchar', length: 26 })
  milestoneId!: string;
  @ManyToOne(() => Milestone)
  @JoinColumn({ name: 'milestone_id', referencedColumnName: 'id' })
  milestone!: Milestone;

  @Column({ name: 'raised_by_decision_id', type: 'varchar', length: 26 })
  raisedByDecisionId!: string;
  @ManyToOne(() => MilestoneDecision)
  @JoinColumn({ name: 'raised_by_decision_id', referencedColumnName: 'id' })
  raisedByDecision!: MilestoneDecision;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'quantity', type: 'int', nullable: true })
  quantity!: number | null;

  /** Its place in the decision's list, from 1. */
  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({
    name: 'accepted_by_decision_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  acceptedByDecisionId!: string | null;
  @ManyToOne(() => MilestoneDecision)
  @JoinColumn({ name: 'accepted_by_decision_id', referencedColumnName: 'id' })
  acceptedByDecision!: MilestoneDecision | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;
}
