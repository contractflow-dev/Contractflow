import { randomUUID } from 'node:crypto';
import {
  ECompanyUserStatus,
  EDocumentUploadStatus,
} from '@contractflow/contracts-schema';
import { In, IsNull, type EntityManager } from 'typeorm';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { Document } from '../entities/document.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import type {
  IDocumentActivityRecords,
  IDocumentContext,
  IDocumentMembershipRecords,
  IDocumentRecords,
  IDocumentVersionRecords,
} from '../interfaces/document-persistence.interface';
import { DocumentRepository } from './document.repository';

export class DocumentContextFactory implements ITransactionContextFactory<IDocumentContext> {
  create(manager: EntityManager): IDocumentContext {
    return new TypeOrmDocumentContext(manager);
  }
}

/**
 * Document persistence bound to one EntityManager. The module also uses it
 * with the default manager for single-statement reads outside transactions.
 */
export class TypeOrmDocumentContext implements IDocumentContext {
  readonly documents: IDocumentRecords;
  readonly versions: IDocumentVersionRecords;
  readonly memberships: IDocumentMembershipRecords;
  readonly activity: IDocumentActivityRecords;

  constructor(manager: EntityManager) {
    const documents = new DocumentRepository(manager.getRepository(Document));
    const versions = manager.getRepository(DocumentVersion);
    const memberships = manager.getRepository(CompanyUser);
    const activity = manager.getRepository(ActivityLog);

    this.documents = {
      findVisible: (scope, documentId) =>
        documents.findVisibleInContract(scope, documentId),
      listVisible: (scope, categories, page) =>
        documents.findVisiblePageInContract(scope, categories, page),
      findOwned: (scope, documentId) =>
        documents.findOwnedInContract(scope, documentId),
      findOwnedForUpdate: (scope, documentId) =>
        documents.findOwnedInContract(scope, documentId, {
          lockForUpdate: true,
        }),
      create: (scope, data) =>
        documents.save(
          scope,
          documents.create(scope, { ...data, contractId: scope.contractId }),
        ),
      softDelete: (scope, documentId, deletedById, now) =>
        documents.softDeleteInContract(scope, documentId, deletedById, now),
    };

    this.versions = {
      listForDocuments: (documentIds) =>
        documentIds.length
          ? versions.find({
              where: { documentId: In(documentIds) },
              order: { versionNumber: 'DESC' },
            })
          : Promise.resolve([]),
      findForDocument: (documentId, versionId) =>
        versions.findOne({ where: { id: versionId, documentId } }),
      nextVersionNumber: async (documentId) => {
        const row = await versions
          .createQueryBuilder('version')
          .select('MAX(version.versionNumber)', 'max')
          .where('version.documentId = :documentId', { documentId })
          .getRawOne<{ max: number | string | null }>();
        return Number(row?.max ?? 0) + 1;
      },
      create: (data) =>
        versions.save(
          versions.create({
            ...data,
            uploadStatus: EDocumentUploadStatus.PENDING_UPLOAD,
            storageVersionId: null,
            failureReason: null,
          }),
        ),
      claimForProcessing: async (documentId, versionId) => {
        const result = await versions.update(
          {
            id: versionId,
            documentId,
            uploadStatus: EDocumentUploadStatus.PENDING_UPLOAD,
          },
          { uploadStatus: EDocumentUploadStatus.PROCESSING },
        );
        return Boolean(result.affected);
      },
      releaseClaim: async (versionId) => {
        await versions.update(
          { id: versionId, uploadStatus: EDocumentUploadStatus.PROCESSING },
          { uploadStatus: EDocumentUploadStatus.PENDING_UPLOAD },
        );
      },
      markAvailable: async (versionId, result) => {
        await versions.update(
          { id: versionId, uploadStatus: EDocumentUploadStatus.PROCESSING },
          {
            uploadStatus: EDocumentUploadStatus.AVAILABLE,
            storageVersionId: result.storageVersionId,
            uploadedAt: result.uploadedAt,
            uploadExpiresAt: null,
            failureReason: null,
          },
        );
      },
      markFailed: async (versionId, reason) => {
        await versions.update(
          { id: versionId },
          {
            uploadStatus: EDocumentUploadStatus.FAILED,
            uploadExpiresAt: null,
            failureReason: reason.slice(0, 255),
          },
        );
      },
    };

    this.memberships = {
      findActive: (userId, companyId) =>
        memberships.findOne({
          where: {
            userId,
            companyId,
            status: ECompanyUserStatus.ACTIVE,
            leftAt: IsNull(),
          },
          select: { id: true },
        }),
    };

    this.activity = {
      record: async (data) => {
        // activity_log.entity_id is a uuid column, so ULID document ids are
        // kept in metadata (the same convention as contract activity).
        await activity.save(
          activity.create({
            contractId: data.contractId,
            companyId: data.companyId,
            actorUserId: data.actorCompanyUserId,
            action: data.action,
            entityType: 'document',
            entityId: randomUUID(),
            summary: data.summary.slice(0, 500),
            changes: { before: null, after: data.details ?? {} },
            metadata: {
              documentId: data.documentId,
              ...(data.versionId ? { versionId: data.versionId } : {}),
            },
            ipAddress: null,
            userAgent: null,
            requestId: null,
            occurredAt: data.occurredAt,
          }),
        );
      },
    };
  }
}
