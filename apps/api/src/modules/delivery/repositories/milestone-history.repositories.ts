import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import { AppendOnlyContractScopedRepository } from '../../../common/database/repositories/appendonly-contract-scoped.repository';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { DocumentVersion } from '../../cross-cutting/entities/document-version.entity';
import { Document } from '../../cross-cutting/entities/document.entity';
import { MilestoneDecision } from '../entities/milestone-decision.entity';
import { MilestoneOutstandingItem } from '../entities/milestone-outstanding-item.entity';
import { MilestoneSubmissionEvidence } from '../entities/milestone-submission-evidence.entity';
import { MilestoneSubmissionItem } from '../entities/milestone-submission-item.entity';
import { MilestoneSubmission } from '../entities/milestone-submission.entity';
import type { IEvidenceRecord } from '../interface/milestone-workflow-persistence.interface';

/**
 * The milestone history tables. Each is append-only: the inherited `update`
 * and `delete` throw, and the database refuses updates (migration
 * `MilestoneWorkflow1793800000000`). Every query is limited to the scoped
 * contract, and the scope's company must be a party to it.
 */

type Scope = IContractCompanyScope;

@Injectable()
export class MilestoneSubmissionRepository extends AppendOnlyContractScopedRepository<
  MilestoneSubmission,
  Scope
> {
  constructor(
    @InjectRepository(MilestoneSubmission)
    repository: Repository<MilestoneSubmission>,
  ) {
    super(repository);
  }

  countForMilestone(scope: Scope, milestoneId: string): Promise<number> {
    return this.count(scope, { milestoneId });
  }

  latestForMilestone(scope: Scope, milestoneId: string) {
    return this.findOne(scope, {
      where: { milestoneId },
      order: { sequence: 'DESC' },
    });
  }

  findInMilestone(scope: Scope, milestoneId: string, submissionId: string) {
    return this.findOne(scope, { where: { id: submissionId, milestoneId } });
  }

  listForMilestone(scope: Scope, milestoneId: string) {
    return this.findAll(scope, {
      where: { milestoneId },
      order: { sequence: 'ASC' },
    });
  }

  append(scope: Scope, data: Partial<MilestoneSubmission>) {
    return this.save(scope, this.create(scope, data));
  }
}

@Injectable()
export class MilestoneDecisionRepository extends AppendOnlyContractScopedRepository<
  MilestoneDecision,
  Scope
> {
  constructor(
    @InjectRepository(MilestoneDecision)
    repository: Repository<MilestoneDecision>,
  ) {
    super(repository);
  }

  latestForMilestone(scope: Scope, milestoneId: string) {
    return this.findOne(scope, {
      where: { milestoneId },
      order: { decidedAt: 'DESC', id: 'DESC' },
    });
  }

  findForSubmission(scope: Scope, submissionId: string) {
    return this.findOne(scope, { where: { submissionId } });
  }

  listForMilestone(scope: Scope, milestoneId: string) {
    return this.findAll(scope, {
      where: { milestoneId },
      order: { decidedAt: 'ASC', id: 'ASC' },
    });
  }

  listForSubmissions(scope: Scope, submissionIds: string[]) {
    if (!submissionIds.length) return Promise.resolve([]);
    return this.findAll(scope, { where: { submissionId: In(submissionIds) } });
  }

  append(scope: Scope, data: Partial<MilestoneDecision>) {
    return this.save(scope, this.create(scope, data));
  }
}

@Injectable()
export class MilestoneSubmissionEvidenceRepository extends AppendOnlyContractScopedRepository<
  MilestoneSubmissionEvidence,
  Scope
> {
  constructor(
    @InjectRepository(MilestoneSubmissionEvidence)
    repository: Repository<MilestoneSubmissionEvidence>,
  ) {
    super(repository);
  }

  appendMany(scope: Scope, rows: Partial<MilestoneSubmissionEvidence>[]) {
    return this.saveMany(scope, this.createMany(scope, rows));
  }

  /** Each submission's evidence with its document's title and version, in order. */
  async listWithFiles(
    scope: Scope,
    submissionIds: string[],
  ): Promise<IEvidenceRecord[]> {
    if (!submissionIds.length) return [];
    const query = await this.createScopedQueryBuilder(scope, 'evidence');
    const rows = await query
      .innerJoin(Document, 'document', 'document.id = evidence.documentId')
      .innerJoin(
        DocumentVersion,
        'version',
        'version.id = evidence.documentVersionId',
      )
      .andWhere('evidence.submissionId IN (:...submissionIds)', {
        submissionIds,
      })
      .select([
        'evidence.id AS "id"',
        'evidence.submissionId AS "submissionId"',
        'evidence.documentId AS "documentId"',
        'evidence.documentVersionId AS "documentVersionId"',
        'evidence.caption AS "caption"',
        'document.title AS "title"',
        'version.fileName AS "fileName"',
        'version.versionNumber AS "versionNumber"',
      ])
      .orderBy('evidence.position', 'ASC')
      .getRawMany<IEvidenceRecord>();
    return rows.map((row) => ({
      ...row,
      versionNumber: Number(row.versionNumber),
    }));
  }
}

@Injectable()
export class MilestoneSubmissionItemRepository extends AppendOnlyContractScopedRepository<
  MilestoneSubmissionItem,
  Scope
> {
  constructor(
    @InjectRepository(MilestoneSubmissionItem)
    repository: Repository<MilestoneSubmissionItem>,
  ) {
    super(repository);
  }

  appendMany(scope: Scope, rows: Partial<MilestoneSubmissionItem>[]) {
    return this.saveMany(scope, this.createMany(scope, rows));
  }

  listForSubmissions(scope: Scope, submissionIds: string[]) {
    if (!submissionIds.length) return Promise.resolve([]);
    return this.findAll(scope, { where: { submissionId: In(submissionIds) } });
  }

  /** Which submissions covered each item, oldest submission first. */
  async listForItems(
    scope: Scope,
    itemIds: string[],
  ): Promise<Array<{ itemId: string; submissionId: string }>> {
    if (!itemIds.length) return [];
    const query = await this.createScopedQueryBuilder(scope, 'link');
    return query
      .innerJoin(
        MilestoneSubmission,
        'submission',
        'submission.id = link.submissionId',
      )
      .andWhere('link.outstandingItemId IN (:...itemIds)', { itemIds })
      .select('link.outstandingItemId', 'itemId')
      .addSelect('link.submissionId', 'submissionId')
      .orderBy('submission.sequence', 'ASC')
      .getRawMany<{ itemId: string; submissionId: string }>();
  }
}

/**
 * Outstanding work items. Written once when a partial approval raises them;
 * the only later change is their acceptance, recorded once (`accept`).
 */
@Injectable()
export class MilestoneOutstandingItemRepository extends AppendOnlyContractScopedRepository<
  MilestoneOutstandingItem,
  Scope
> {
  constructor(
    @InjectRepository(MilestoneOutstandingItem)
    repository: Repository<MilestoneOutstandingItem>,
  ) {
    super(repository);
  }

  appendMany(scope: Scope, rows: Partial<MilestoneOutstandingItem>[]) {
    return this.saveMany(scope, this.createMany(scope, rows));
  }

  /** The milestone's open items, locked for update, in the order raised. */
  listOpenForUpdate(scope: Scope, milestoneId: string) {
    return this.findAll(scope, {
      where: { milestoneId, acceptedByDecisionId: IsNull() },
      order: { createdAt: 'ASC', position: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  listForMilestone(scope: Scope, milestoneId: string) {
    return this.findAll(scope, {
      where: { milestoneId },
      order: { createdAt: 'ASC', position: 'ASC', id: 'ASC' },
    });
  }

  /** Items raised or accepted by any of the decisions. */
  async listForDecisions(scope: Scope, decisionIds: string[]) {
    if (!decisionIds.length) return [];
    const query = await this.createScopedQueryBuilder(scope, 'item');
    return query
      .andWhere(
        '(item.raisedByDecisionId IN (:...decisionIds) OR item.acceptedByDecisionId IN (:...decisionIds))',
        { decisionIds },
      )
      .orderBy('item.createdAt', 'ASC')
      .addOrderBy('item.position', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .getMany();
  }

  /**
   * Records acceptance of still-open items of the scoped contract; returns
   * how many it accepted. An accepted item is never accepted again.
   */
  async accept(
    scope: Scope,
    itemIds: string[],
    decisionId: string,
    acceptedAt: Date,
  ): Promise<number> {
    if (!itemIds.length) return 0;
    const { contractId } = await this.assertScope(scope);
    const result = await this.repository.update(
      { id: In(itemIds), contractId, acceptedByDecisionId: IsNull() },
      { acceptedByDecisionId: decisionId, acceptedAt },
    );
    return result.affected ?? 0;
  }
}
