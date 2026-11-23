import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { EMilestoneSubmissionType } from '@contractflow/contracts-schema';
import { Contract } from '../../contract/entities/contract.entity';
import { ContractParty } from '../../contract/entities/contract-party.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Milestone } from './milestone.entity';

/** One submission of a milestone. Written once; never changed. */
@Entity('milestone_submission')
export class MilestoneSubmission extends BaseCustomEntity {
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

  /** 1, 2, 3, ... per milestone. */
  @Column({ name: 'sequence', type: 'int' })
  sequence!: number;

  @Column({ name: 'submission_type', type: 'varchar', length: 20 })
  submissionType!: EMilestoneSubmissionType;

  /** The rejection or partial approval this submission answers. */
  @Column({
    name: 'previous_decision_id',
    type: 'varchar',
    length: 26,
    nullable: true,
  })
  previousDecisionId!: string | null;

  @Column({ name: 'submitted_by_id', type: 'varchar', length: 26 })
  submittedById!: string;
  @ManyToOne(() => CompanyUser)
  @JoinColumn({ name: 'submitted_by_id', referencedColumnName: 'id' })
  submittedBy!: CompanyUser;

  @Column({ name: 'submitted_by_party_id', type: 'varchar', length: 26 })
  submittedByPartyId!: string;
  @ManyToOne(() => ContractParty)
  @JoinColumn({ name: 'submitted_by_party_id', referencedColumnName: 'id' })
  submittedByParty!: ContractParty;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @Column({ name: 'notes', type: 'text' })
  notes!: string;

  @Column({ name: 'reported_progress_bps', type: 'int', nullable: true })
  reportedProgressBps!: number | null;
}
