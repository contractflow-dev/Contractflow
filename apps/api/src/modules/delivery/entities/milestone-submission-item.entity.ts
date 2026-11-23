import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { MilestoneOutstandingItem } from './milestone-outstanding-item.entity';
import { MilestoneSubmission } from './milestone-submission.entity';

/** An outstanding item an outstanding-work submission covered. Written once. */
@Entity('milestone_submission_item')
export class MilestoneSubmissionItem extends BaseCustomEntity {
  @Column({ name: 'contract_id', type: 'varchar', length: 26 })
  contractId!: string;
  @ManyToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id', referencedColumnName: 'id' })
  contract!: Contract;

  @Column({ name: 'submission_id', type: 'varchar', length: 26 })
  submissionId!: string;
  @ManyToOne(() => MilestoneSubmission)
  @JoinColumn({ name: 'submission_id', referencedColumnName: 'id' })
  submission!: MilestoneSubmission;

  @Column({ name: 'outstanding_item_id', type: 'varchar', length: 26 })
  outstandingItemId!: string;
  @ManyToOne(() => MilestoneOutstandingItem)
  @JoinColumn({ name: 'outstanding_item_id', referencedColumnName: 'id' })
  outstandingItem!: MilestoneOutstandingItem;
}
