import type {
  EDocumentCategory,
  EDocumentStatus,
  EDocumentVisibility,
} from '@contractflow/contracts-schema';
import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import type { Document } from '../entities/document.entity';
import type { DocumentVersion } from '../entities/document-version.entity';

export const DOCUMENT_PERSISTENCE = Symbol('DOCUMENT_PERSISTENCE');
export const DOCUMENT_UNIT_OF_WORK = Symbol('DOCUMENT_UNIT_OF_WORK');

export interface ICreateDocumentRecord {
  title: string;
  documentNumber: string;
  category: EDocumentCategory;
  visibility: EDocumentVisibility;
  status: EDocumentStatus;
}

export type ICreateDocumentVersionRecord = Pick<
  DocumentVersion,
  | 'id'
  | 'documentId'
  | 'versionNumber'
  | 'storageKey'
  | 'storageProvider'
  | 'storageBucket'
  | 'fileName'
  | 'mimeType'
  | 'sizeBytes'
  | 'checksumSha256'
  | 'changeNote'
  | 'uploadedById'
  | 'uploadedAt'
  | 'uploadExpiresAt'
>;

export interface IDocumentPage {
  items: Document[];
  total: number;
}

/**
 * Documents are reached only through an authorized contract scope. "Visible"
 * means owned by the scope company, or shared (public) with every party of
 * the scope contract. Writes are limited to the owner company.
 */
export interface IDocumentRecords {
  findVisible(
    scope: IContractCompanyScope,
    documentId: string,
  ): Promise<Document | null>;
  listVisible(
    scope: IContractCompanyScope,
    categories: EDocumentCategory[],
    page: { skip: number; take: number },
  ): Promise<IDocumentPage>;
  findOwned(
    scope: IContractCompanyScope,
    documentId: string,
  ): Promise<Document | null>;
  /** Locks the owned row for the rest of the transaction. */
  findOwnedForUpdate(
    scope: IContractCompanyScope,
    documentId: string,
  ): Promise<Document | null>;
  create(
    scope: IContractCompanyScope,
    data: ICreateDocumentRecord,
  ): Promise<Document>;
  /** Returns false when the document was not active in the scope. */
  softDelete(
    scope: IContractCompanyScope,
    documentId: string,
    deletedById: string,
    now: Date,
  ): Promise<boolean>;
}

/** Version access is only used after the parent document is authorized. */
export interface IDocumentVersionRecords {
  listForDocuments(documentIds: string[]): Promise<DocumentVersion[]>;
  findForDocument(
    documentId: string,
    versionId: string,
  ): Promise<DocumentVersion | null>;
  nextVersionNumber(documentId: string): Promise<number>;
  create(data: ICreateDocumentVersionRecord): Promise<DocumentVersion>;
  /** Atomically moves a pending upload to processing; false if not pending. */
  claimForProcessing(documentId: string, versionId: string): Promise<boolean>;
  /** Returns a processing upload to pending (for example, not yet uploaded). */
  releaseClaim(versionId: string): Promise<void>;
  markAvailable(
    versionId: string,
    result: { storageVersionId: string | null; uploadedAt: Date },
  ): Promise<void>;
  markFailed(versionId: string, reason: string): Promise<void>;
}

export interface IDocumentMembershipRecords {
  findActive(userId: string, companyId: string): Promise<{ id: string } | null>;
}

export interface IDocumentActivityRecord {
  contractId: string;
  companyId: string;
  /** Company membership (company_user) of the actor. */
  actorCompanyUserId: string;
  action: string;
  summary: string;
  documentId: string;
  versionId?: string;
  details?: Record<string, string | number | boolean | null>;
  occurredAt: Date;
}

export interface IDocumentActivityRecords {
  record(data: IDocumentActivityRecord): Promise<void>;
}

export interface IDocumentContext {
  documents: IDocumentRecords;
  versions: IDocumentVersionRecords;
  memberships: IDocumentMembershipRecords;
  activity: IDocumentActivityRecords;
}

export type IDocumentUnitOfWork = IUnitOfWork<IDocumentContext>;
