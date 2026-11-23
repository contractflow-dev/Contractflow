import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { EMilestoneDecisionType } from '@contractflow/contracts-schema';
import { Contract } from '../../contract/entities/contract.entity';
import { ContractParty } from '../../contract/entities/contract-party.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { MilestoneSubmission } from './milestone-submission.entity';
import { Milestone } from './milestone.entity';

/**
 * The Client Project Manager's decision on one submission (unique per
 * submission). Written once; never changed.
 */
@Entity('milestone_decision')
export class MilestoneDecision extends BaseCustomEntity {
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

  @Column({ name: 'submission_id', type: 'varchar', length: 26 })
  submissionId!: string;
  @ManyToOne(() => MilestoneSubmission)
  @JoinColumn({ name: 'submission_id', referencedColumnName: 'id' })
  submission!: MilestoneSubmission;

  @Column({ name: 'decision', type: 'varchar', length: 20 })
  decision!: EMilestoneDecisionType;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  /** This decision's share of the whole milestone. */
  @Column({ name: 'approved_bps', type: 'int' })
  approvedBps!: number;

  /** The milestone's accepted share after this decision. */
  @Column({ name: 'cumulative_approved_bps', type: 'int' })
  cumulativeApprovedBps!: number;

  @Column({ name: 'approved_work', type: 'text', nullable: true })
  approvedWork!: string | null;

  @Column({ name: 'approved_quantity', type: 'int', nullable: true })
  approvedQuantity!: number | null;

  @Column({ name: 'decided_by_id', type: 'varchar', length: 26 })
  decidedById!: string;
  @ManyToOne(() => CompanyUser)
  @JoinColumn({ name: 'decided_by_id', referencedColumnName: 'id' })
  decidedBy!: CompanyUser;

  @Column({ name: 'decided_by_party_id', type: 'varchar', length: 26 })
  decidedByPartyId!: string;
  @ManyToOne(() => ContractParty)
  @JoinColumn({ name: 'decided_by_party_id', referencedColumnName: 'id' })
  decidedByParty!: ContractParty;

  @Column({ name: 'decided_at', type: 'timestamptz' })
  decidedAt!: Date;
}
