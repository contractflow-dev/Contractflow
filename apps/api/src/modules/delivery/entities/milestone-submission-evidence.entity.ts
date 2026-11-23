import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity';
import { BaseCustomEntity } from '../../cross-cutting/entities/base-custom.entity';
import { Document } from '../../cross-cutting/entities/document.entity';
import { DocumentVersion } from '../../cross-cutting/entities/document-version.entity';
import { MilestoneSubmission } from './milestone-submission.entity';

/**
 * A document kept as evidence of a submission, at the version it had when
 * submitted, so a later version never changes earlier evidence.
 */
@Entity('milestone_submission_evidence')
export class MilestoneSubmissionEvidence extends BaseCustomEntity {
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

  @Column({ name: 'document_id', type: 'varchar', length: 26 })
  documentId!: string;
  @ManyToOne(() => Document)
  @JoinColumn({ name: 'document_id', referencedColumnName: 'id' })
  document!: Document;

  @Column({ name: 'document_version_id', type: 'varchar', length: 26 })
  documentVersionId!: string;
  @ManyToOne(() => DocumentVersion)
  @JoinColumn({ name: 'document_version_id', referencedColumnName: 'id' })
  documentVersion!: DocumentVersion;

  @Column({ name: 'caption', type: 'varchar', length: 255, nullable: true })
  caption!: string | null;

  /** Its place in the submission's list, from 1. */
  @Column({ name: 'position', type: 'int' })
  position!: number;
}
