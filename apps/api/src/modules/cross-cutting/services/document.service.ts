import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EDocumentCategory,
  EDocumentStatus,
  EDocumentUploadStatus,
  type CreateDocumentUploadRequest,
  type CreateDocumentVersionUploadRequest,
  type DocumentDetail,
  type DocumentDownloadUrl,
  type DocumentSummary,
  type DocumentUploadSession,
  type DocumentVersionSummary,
  type IPaginatedResponse,
} from '@contractflow/contracts-schema';
import { ulid } from 'ulid';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';
import type { IPageQuery } from '../../../common/application/pagination.interface';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import {
  OBJECT_STORAGE,
  type IObjectStorage,
} from '../../../common/storage/object-storage.interface';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import type { ContractWorkspace } from '../../contract/services/contract-workspace';
import type { Document } from '../entities/document.entity';
import type { DocumentVersion } from '../entities/document-version.entity';
import {
  DOCUMENT_PERSISTENCE,
  DOCUMENT_UNIT_OF_WORK,
  type IDocumentContext,
  type IDocumentUnitOfWork,
} from '../interfaces/document-persistence.interface';
import {
  buildDocumentStorageKey,
  fileExtension,
  FILE_SIGNATURE_PREFIX_BYTES,
  matchesDocumentFileSignature,
  sha256HexToBase64,
  validateDocumentFile,
  type IValidatedDocumentFile,
} from './document-file-policy';

/**
 * Contract workspace whose roles may work with each document category.
 * Every other category is available to any contract role ("general").
 */
const CATEGORY_WORKSPACE: Record<EDocumentCategory, ContractWorkspace> = {
  [EDocumentCategory.HSE]: 'hse',
  [EDocumentCategory.INVOICE]: 'finance',
  [EDocumentCategory.CERTIFICATE]: 'general',
  [EDocumentCategory.CONTRACT]: 'general',
  [EDocumentCategory.REPORT]: 'general',
  [EDocumentCategory.OTHER]: 'general',
};

const RESTRICTED_WORKSPACES = ['hse', 'finance'] as const;

export interface IDocumentActor {
  userId: string;
  companyId: string;
  contractId: string;
}

interface IAuthorizedDocument {
  scope: IContractCompanyScope;
  document: Document;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly maxUploadBytes: number;
  private readonly uploadUrlTtlSeconds: number;
  private readonly downloadUrlTtlSeconds: number;

  constructor(
    private readonly access: ContractAccessService,
    @Inject(DOCUMENT_PERSISTENCE)
    private readonly persistence: IDocumentContext,
    @Inject(DOCUMENT_UNIT_OF_WORK)
    private readonly unitOfWork: IDocumentUnitOfWork,
    @Inject(OBJECT_STORAGE) private readonly storage: IObjectStorage,
    config: ConfigService,
  ) {
    this.maxUploadBytes = config.getOrThrow<number>(
      'DOCUMENT_MAX_UPLOAD_BYTES',
    );
    this.uploadUrlTtlSeconds = config.getOrThrow<number>(
      'DOCUMENT_UPLOAD_URL_TTL_SECONDS',
    );
    this.downloadUrlTtlSeconds = config.getOrThrow<number>(
      'DOCUMENT_DOWNLOAD_URL_TTL_SECONDS',
    );
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(
    actor: IDocumentActor,
    query: IPageQuery,
  ): Promise<IPaginatedResponse<DocumentSummary>> {
    const scope = await this.authorize(actor, 'general', 'list');
    const categories = await this.accessibleCategories(actor);
    const page = await this.persistence.documents.listVisible(
      scope,
      categories,
      { skip: pageOffset(query), take: query.limit },
    );
    const versions = await this.persistence.versions.listForDocuments(
      page.items.map(({ id }) => id),
    );
    const items = page.items.map((document) =>
      toDocumentSummary(
        document,
        versions.filter((version) => version.documentId === document.id),
      ),
    );
    return toPaginatedResponse({ items, total: page.total }, query);
  }

  async get(
    actor: IDocumentActor,
    documentId: string,
  ): Promise<DocumentDetail> {
    const { scope, document } = await this.authorizeVisible(
      actor,
      documentId,
      'view',
    );
    return this.detail(scope, document);
  }

  async createDownloadUrl(
    actor: IDocumentActor,
    documentId: string,
    versionId?: string,
  ): Promise<DocumentDownloadUrl> {
    const { scope, document } = await this.authorizeVisible(
      actor,
      documentId,
      'download',
    );
    const versions = await this.persistence.versions.listForDocuments([
      document.id,
    ]);
    const version = versionId
      ? versions.find(({ id }) => id === versionId)
      : latestAvailable(versions);
    if (!version || version.uploadStatus !== EDocumentUploadStatus.AVAILABLE) {
      throw new NotFoundException('No downloadable file was found');
    }
    const member = await this.requireMember(actor);

    const download = await this.storage.createDownloadUrl({
      key: version.storageKey,
      fileName: version.fileName,
      contentType: version.mimeType,
      expiresInSeconds: this.downloadUrlTtlSeconds,
    });
    // The URL itself is a bearer credential and is never recorded.
    await this.persistence.activity.record({
      contractId: scope.contractId,
      companyId: scope.companyId,
      actorCompanyUserId: member.id,
      action: 'document.downloaded',
      summary: `Downloaded "${document.title}" (version ${version.versionNumber})`,
      documentId: document.id,
      versionId: version.id,
      details: { ownerCompanyId: document.ownerCompanyId },
      occurredAt: new Date(),
    });
    return {
      url: download.url,
      expiresAt: download.expiresAt.toISOString(),
      fileName: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
    };
  }

  // -------------------------------------------------------------------------
  // Uploads
  // -------------------------------------------------------------------------

  async createUpload(
    actor: IDocumentActor,
    request: CreateDocumentUploadRequest,
  ): Promise<DocumentUploadSession> {
    const file = validateDocumentFile(request, this.maxUploadBytes);
    const scope = await this.authorize(
      actor,
      CATEGORY_WORKSPACE[request.category],
      'upload',
    );
    const now = new Date();

    return this.unitOfWork.execute(async (context) => {
      const member = await this.requireMember(actor, context);
      const document = await context.documents.create(scope, {
        title: request.title,
        documentNumber: request.documentNumber ?? generateDocumentNumber(),
        category: request.category,
        visibility: request.visibility,
        status: EDocumentStatus.VERIFICATION_PENDING,
      });
      return this.startVersionUpload(context, {
        scope,
        document,
        versionNumber: 1,
        file,
        checksumSha256: request.checksumSha256,
        changeNote: request.changeNote,
        uploadedById: member.id,
        now,
      });
    });
  }

  async createVersionUpload(
    actor: IDocumentActor,
    documentId: string,
    request: CreateDocumentVersionUploadRequest,
  ): Promise<DocumentUploadSession> {
    const file = validateDocumentFile(request, this.maxUploadBytes);
    const { scope } = await this.authorizeOwned(actor, documentId, 'replace');
    const now = new Date();

    return this.unitOfWork.execute(async (context) => {
      const member = await this.requireMember(actor, context);
      // The row lock serializes version numbering for this document.
      const document = await context.documents.findOwnedForUpdate(
        scope,
        documentId,
      );
      if (!document) throw new NotFoundException('Document was not found');
      return this.startVersionUpload(context, {
        scope,
        document,
        versionNumber: await context.versions.nextVersionNumber(document.id),
        file,
        checksumSha256: request.checksumSha256,
        changeNote: request.changeNote,
        uploadedById: member.id,
        now,
      });
    });
  }

  /**
   * Verifies the uploaded object and makes the version available. The object
   * must exist with the exact size, type and checksum that were signed, and
   * its leading bytes must match the allowlisted file type.
   */
  async completeUpload(
    actor: IDocumentActor,
    documentId: string,
    versionId: string,
  ): Promise<DocumentDetail> {
    const { scope, document } = await this.authorizeOwned(
      actor,
      documentId,
      'complete upload',
    );
    const member = await this.requireMember(actor);
    const version = await this.persistence.versions.findForDocument(
      document.id,
      versionId,
    );
    if (!version) throw new NotFoundException('Document version was not found');
    if (version.uploadStatus === EDocumentUploadStatus.AVAILABLE) {
      return this.detail(scope, document);
    }
    if (version.uploadStatus === EDocumentUploadStatus.FAILED) {
      throw new UnprocessableEntityException(
        'This upload failed verification. Start a new upload.',
      );
    }
    const claimed = await this.persistence.versions.claimForProcessing(
      document.id,
      version.id,
    );
    if (!claimed) {
      throw new ConflictException('This upload is already being processed');
    }

    let failure: string | null;
    let storageVersionId: string | null = null;
    try {
      const result = await this.verifyStoredObject(version);
      if (result.kind === 'missing') {
        await this.persistence.versions.releaseClaim(version.id);
        throw new ConflictException(
          'The file has not been uploaded yet. Upload it, then try again.',
        );
      }
      failure = result.kind === 'invalid' ? result.reason : null;
      storageVersionId = result.kind === 'valid' ? result.versionId : null;
    } catch (error) {
      if (!(error instanceof ConflictException)) {
        // Storage was unreachable: leave the upload retryable.
        await this.persistence.versions.releaseClaim(version.id);
      }
      throw error;
    }

    if (failure) {
      await this.failUpload(scope, document, version, member.id, failure);
      throw new UnprocessableEntityException(
        'The uploaded file could not be verified and was rejected.',
      );
    }

    const now = new Date();
    await this.unitOfWork.execute(async (context) => {
      await context.versions.markAvailable(version.id, {
        storageVersionId,
        uploadedAt: now,
      });
      await context.activity.record({
        contractId: scope.contractId,
        companyId: scope.companyId,
        actorCompanyUserId: member.id,
        action:
          version.versionNumber > 1
            ? 'document.version_added'
            : 'document.upload_completed',
        summary:
          version.versionNumber > 1
            ? `Added version ${version.versionNumber} of "${document.title}"`
            : `Uploaded "${document.title}"`,
        documentId: document.id,
        versionId: version.id,
        details: {
          versionNumber: version.versionNumber,
          mimeType: version.mimeType,
          sizeBytes: version.sizeBytes,
        },
        occurredAt: now,
      });
    });
    return this.detail(scope, document);
  }

  // -------------------------------------------------------------------------
  // Deletion
  // -------------------------------------------------------------------------

  /**
   * Soft-deletes the document record first, so it is immediately inaccessible,
   * then deletes its stored objects. A storage failure after the commit leaves
   * an orphaned object to clean up, never a visible record without a file.
   */
  async delete(actor: IDocumentActor, documentId: string): Promise<void> {
    const { scope, document } = await this.authorizeOwned(
      actor,
      documentId,
      'delete',
    );
    const now = new Date();
    await this.unitOfWork.execute(async (context) => {
      const member = await this.requireMember(actor, context);
      const deleted = await context.documents.softDelete(
        scope,
        document.id,
        member.id,
        now,
      );
      if (!deleted) throw new NotFoundException('Document was not found');
      await context.activity.record({
        contractId: scope.contractId,
        companyId: scope.companyId,
        actorCompanyUserId: member.id,
        action: 'document.deleted',
        summary: `Deleted "${document.title}"`,
        documentId: document.id,
        details: { documentNumber: document.documentNumber },
        occurredAt: now,
      });
    });

    const versions = await this.persistence.versions.listForDocuments([
      document.id,
    ]);
    const results = await Promise.allSettled(
      versions
        .filter(
          ({ storageProvider }) => storageProvider === this.storage.provider,
        )
        .map(({ storageKey }) => this.storage.deleteObject(storageKey)),
    );
    const failures = results.filter(({ status }) => status === 'rejected');
    if (failures.length) {
      this.logger.error(
        `Document ${document.id} was deleted but ${failures.length} stored object(s) could not be removed; they require cleanup.`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async startVersionUpload(
    context: IDocumentContext,
    input: {
      scope: IContractCompanyScope;
      document: Document;
      versionNumber: number;
      file: IValidatedDocumentFile;
      checksumSha256: string;
      changeNote?: string;
      uploadedById: string;
      now: Date;
    },
  ): Promise<DocumentUploadSession> {
    const { scope, document, file, now } = input;
    const versionId = ulid();
    const storageKey = buildDocumentStorageKey({
      companyId: scope.companyId,
      contractId: scope.contractId,
      documentId: document.id,
      versionId,
      extension: file.extension,
    });
    const upload = await this.storage.createUploadUrl({
      key: storageKey,
      contentType: file.contentType,
      contentLength: file.sizeBytes,
      checksumSha256Base64: sha256HexToBase64(input.checksumSha256),
      expiresInSeconds: this.uploadUrlTtlSeconds,
    });
    const version = await context.versions.create({
      id: versionId,
      documentId: document.id,
      versionNumber: input.versionNumber,
      storageKey,
      storageProvider: this.storage.provider,
      storageBucket: this.storage.bucket,
      fileName: file.fileName,
      mimeType: file.contentType,
      sizeBytes: file.sizeBytes,
      checksumSha256: input.checksumSha256,
      changeNote: input.changeNote ?? '',
      uploadedById: input.uploadedById,
      uploadedAt: now,
      uploadExpiresAt: upload.expiresAt,
    });
    await context.activity.record({
      contractId: scope.contractId,
      companyId: scope.companyId,
      actorCompanyUserId: input.uploadedById,
      action: 'document.upload_initiated',
      summary: `Started uploading version ${input.versionNumber} of "${document.title}"`,
      documentId: document.id,
      versionId,
      details: {
        versionNumber: input.versionNumber,
        mimeType: file.contentType,
        sizeBytes: file.sizeBytes,
      },
      occurredAt: now,
    });

    const versions = await context.versions.listForDocuments([document.id]);
    return {
      document: toDocumentSummary(document, versions),
      version: toVersionSummary(version),
      upload: {
        url: upload.url,
        method: upload.method,
        headers: upload.headers,
        expiresAt: upload.expiresAt.toISOString(),
      },
    };
  }

  private async verifyStoredObject(
    version: DocumentVersion,
  ): Promise<
    | { kind: 'missing' }
    | { kind: 'invalid'; reason: string }
    | { kind: 'valid'; versionId: string | null }
  > {
    const stored = await this.storage.headObject(version.storageKey);
    if (!stored) {
      const expired =
        version.uploadExpiresAt !== null &&
        version.uploadExpiresAt.getTime() < Date.now();
      return expired
        ? { kind: 'invalid', reason: 'upload_not_received' }
        : { kind: 'missing' };
    }
    if (stored.sizeBytes !== version.sizeBytes) {
      return { kind: 'invalid', reason: 'size_mismatch' };
    }
    if (
      stored.contentType !== null &&
      stored.contentType.toLowerCase() !== version.mimeType
    ) {
      return { kind: 'invalid', reason: 'content_type_mismatch' };
    }
    const expectedChecksum = sha256HexToBase64(version.checksumSha256);
    if (stored.checksumSha256Base64 === null) {
      // The checksum header is part of the upload signature, so the provider
      // validated it on write; some S3-compatible stores do not echo it back.
      this.logger.warn(
        `Storage did not return a checksum for document version ${version.id}`,
      );
    } else if (stored.checksumSha256Base64 !== expectedChecksum) {
      return { kind: 'invalid', reason: 'checksum_mismatch' };
    }
    const extension = fileExtension(version.storageKey);
    const prefix = await this.storage.readObjectPrefix(
      version.storageKey,
      FILE_SIGNATURE_PREFIX_BYTES,
    );
    if (!extension || !matchesDocumentFileSignature(extension, prefix)) {
      return { kind: 'invalid', reason: 'file_signature_mismatch' };
    }
    return { kind: 'valid', versionId: stored.versionId };
  }

  private async failUpload(
    scope: IContractCompanyScope,
    document: Document,
    version: DocumentVersion,
    actorCompanyUserId: string,
    reason: string,
  ): Promise<void> {
    await this.unitOfWork.execute(async (context) => {
      await context.versions.markFailed(version.id, reason);
      await context.activity.record({
        contractId: scope.contractId,
        companyId: scope.companyId,
        actorCompanyUserId,
        action: 'document.upload_failed',
        summary: `Rejected upload of version ${version.versionNumber} of "${document.title}"`,
        documentId: document.id,
        versionId: version.id,
        details: { reason },
        occurredAt: new Date(),
      });
    });
    this.logger.warn(
      `Rejected document version ${version.id} for document ${document.id}: ${reason}`,
    );
    // Rejected content is never served; remove it from storage.
    await this.storage.deleteObject(version.storageKey).catch(() => {
      this.logger.error(
        `Rejected document version ${version.id} could not be removed from storage; it requires cleanup.`,
      );
    });
  }

  private async detail(
    scope: IContractCompanyScope,
    document: Document,
  ): Promise<DocumentDetail> {
    const versions = await this.persistence.versions.listForDocuments([
      document.id,
    ]);
    // Unfinished and rejected uploads are visible to the owner company only.
    const visible =
      document.ownerCompanyId === scope.companyId
        ? versions
        : versions.filter(
            ({ uploadStatus }) =>
              uploadStatus === EDocumentUploadStatus.AVAILABLE,
          );
    return {
      ...toDocumentSummary(document, versions),
      versions: visible.map(toVersionSummary),
    };
  }

  /** Categories whose contract workspace the actor can access. */
  private async accessibleCategories(
    actor: IDocumentActor,
  ): Promise<EDocumentCategory[]> {
    const restricted = await Promise.all(
      RESTRICTED_WORKSPACES.map(async (workspace) => {
        try {
          await this.access.authorize(
            actor.userId,
            actor.companyId,
            actor.contractId,
            workspace,
          );
          return workspace;
        } catch (error) {
          if (error instanceof ForbiddenException) return null;
          throw error;
        }
      }),
    );
    const allowed = new Set<ContractWorkspace>([
      'general',
      ...restricted.filter((workspace) => workspace !== null),
    ]);
    return Object.values(EDocumentCategory).filter((category) =>
      allowed.has(CATEGORY_WORKSPACE[category]),
    );
  }

  private async authorizeVisible(
    actor: IDocumentActor,
    documentId: string,
    operation: string,
  ): Promise<IAuthorizedDocument> {
    const scope = await this.authorize(actor, 'general', operation);
    const document = await this.persistence.documents.findVisible(
      scope,
      documentId,
    );
    return this.authorizeCategory(actor, scope, document, operation);
  }

  /** Writes are limited to the company that owns the document. */
  private async authorizeOwned(
    actor: IDocumentActor,
    documentId: string,
    operation: string,
  ): Promise<IAuthorizedDocument> {
    const scope = await this.authorize(actor, 'general', operation);
    const document = await this.persistence.documents.findOwned(
      scope,
      documentId,
    );
    return this.authorizeCategory(actor, scope, document, operation);
  }

  private async authorizeCategory(
    actor: IDocumentActor,
    scope: IContractCompanyScope,
    document: Document | null,
    operation: string,
  ): Promise<IAuthorizedDocument> {
    if (!document) {
      this.logDenied(actor, operation, 'document not found in scope');
      throw new NotFoundException('Document was not found');
    }
    const workspace = CATEGORY_WORKSPACE[document.category];
    if (workspace !== 'general') {
      await this.authorize(actor, workspace, operation);
    }
    return { scope, document };
  }

  private async authorize(
    actor: IDocumentActor,
    workspace: ContractWorkspace,
    operation: string,
  ): Promise<IContractCompanyScope> {
    try {
      return await this.access.authorize(
        actor.userId,
        actor.companyId,
        actor.contractId,
        workspace,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        this.logDenied(
          actor,
          operation,
          `${workspace} workspace access denied`,
        );
      }
      throw error;
    }
  }

  private async requireMember(
    actor: IDocumentActor,
    context: IDocumentContext = this.persistence,
  ): Promise<{ id: string }> {
    const member = await context.memberships.findActive(
      actor.userId,
      actor.companyId,
    );
    if (!member) {
      throw new ForbiddenException('Active company membership is required');
    }
    return member;
  }

  private logDenied(
    actor: IDocumentActor,
    operation: string,
    reason: string,
  ): void {
    this.logger.warn(
      `Document ${operation} denied for user ${actor.userId} (company ${actor.companyId}, contract ${actor.contractId}): ${reason}`,
    );
  }
}

function generateDocumentNumber(): string {
  return `DOC-${ulid()}`;
}

function latestAvailable(
  versions: DocumentVersion[],
): DocumentVersion | undefined {
  return versions
    .filter(
      ({ uploadStatus }) => uploadStatus === EDocumentUploadStatus.AVAILABLE,
    )
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];
}

function toVersionSummary(version: DocumentVersion): DocumentVersionSummary {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    fileName: version.fileName,
    mimeType: version.mimeType,
    sizeBytes: Number(version.sizeBytes),
    checksumSha256: version.checksumSha256,
    changeNote: version.changeNote,
    uploadStatus: version.uploadStatus,
    uploadedById: version.uploadedById,
    uploadedAt: version.uploadedAt.toISOString(),
  };
}

function toDocumentSummary(
  document: Document,
  versions: DocumentVersion[],
): DocumentSummary {
  const current = latestAvailable(versions);
  return {
    id: document.id,
    contractId: document.contractId,
    ownerCompanyId: document.ownerCompanyId,
    title: document.title,
    documentNumber: document.documentNumber,
    category: document.category,
    visibility: document.visibility,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    currentVersion: current ? toVersionSummary(current) : null,
  };
}
