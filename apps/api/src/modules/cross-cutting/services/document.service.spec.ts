import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  EDocumentCategory,
  EDocumentStatus,
  EDocumentUploadStatus,
  EDocumentVisibility,
} from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IObjectStorage } from '../../../common/storage/object-storage.interface';
import type { ContractAccessService } from '../../contract/services/contract-access.service';
import type { Document } from '../entities/document.entity';
import type { DocumentVersion } from '../entities/document-version.entity';
import type {
  IDocumentContext,
  IDocumentUnitOfWork,
} from '../interfaces/document-persistence.interface';
import { DocumentService, type IDocumentActor } from './document.service';

const COMPANY = '01J00000000000000000000CMP';
const OTHER_COMPANY = '01J00000000000000000000OTH';
const CONTRACT = '01J00000000000000000000CTR';
const DOCUMENT = '01J00000000000000000000DOC';
const VERSION = '01J00000000000000000000VER';
const CHECKSUM =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const CHECKSUM_BASE64 = '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
const PDF_PREFIX = new TextEncoder().encode('%PDF-1.7\n');

const actor: IDocumentActor = {
  userId: 'user-1',
  companyId: COMPANY,
  contractId: CONTRACT,
};
const scope = Object.freeze({ companyId: COMPANY, contractId: CONTRACT });

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: DOCUMENT,
    contractId: CONTRACT,
    ownerCompanyId: COMPANY,
    title: 'Method statement',
    documentNumber: 'MS-001',
    category: EDocumentCategory.REPORT,
    visibility: EDocumentVisibility.PRIVATE,
    status: EDocumentStatus.VERIFICATION_PENDING,
    deletedAt: null,
    deletedById: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  } as Document;
}

function makeVersion(
  overrides: Partial<DocumentVersion> = {},
): DocumentVersion {
  return {
    id: VERSION,
    documentId: DOCUMENT,
    versionNumber: 1,
    storageKey: `companies/${COMPANY}/contracts/${CONTRACT}/documents/${DOCUMENT}/${VERSION}.pdf`,
    storageProvider: 'amazon-s3',
    storageBucket: 'bucket',
    storageVersionId: null,
    fileName: 'method.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    checksumSha256: CHECKSUM,
    changeNote: '',
    uploadedById: 'member-1',
    uploadedAt: new Date('2026-11-01T00:00:00.000Z'),
    uploadStatus: EDocumentUploadStatus.PENDING_UPLOAD,
    uploadExpiresAt: new Date(Date.now() + 60_000),
    failureReason: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  } as DocumentVersion;
}

function makeContext() {
  return {
    documents: {
      findVisible: vi.fn(),
      listVisible: vi.fn(),
      findOwned: vi.fn(),
      findOwnedForUpdate: vi.fn(),
      create: vi.fn(),
      softDelete: vi.fn(),
    },
    versions: {
      listForDocuments: vi.fn().mockResolvedValue([]),
      findForDocument: vi.fn(),
      nextVersionNumber: vi.fn(),
      create: vi.fn(async (data) => makeVersion(data)),
      claimForProcessing: vi.fn().mockResolvedValue(true),
      releaseClaim: vi.fn(),
      markAvailable: vi.fn(),
      markFailed: vi.fn(),
    },
    memberships: {
      findActive: vi.fn().mockResolvedValue({ id: 'member-1' }),
    },
    activity: { record: vi.fn() },
  } satisfies IDocumentContext;
}

describe('DocumentService', () => {
  let authorize: Mock;
  let persistence: ReturnType<typeof makeContext>;
  let transaction: ReturnType<typeof makeContext>;
  let storage: { [K in keyof IObjectStorage]: IObjectStorage[K] } & {
    createUploadUrl: Mock;
    createDownloadUrl: Mock;
    headObject: Mock;
    readObjectPrefix: Mock;
    deleteObject: Mock;
  };
  let service: DocumentService;

  beforeEach(() => {
    authorize = vi.fn().mockResolvedValue(scope);
    persistence = makeContext();
    transaction = makeContext();
    storage = {
      provider: 'amazon-s3',
      bucket: 'bucket',
      createUploadUrl: vi.fn().mockResolvedValue({
        url: 'https://signed-upload',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'x-amz-checksum-sha256': CHECKSUM_BASE64,
        },
        expiresAt: new Date('2026-11-06T00:05:00.000Z'),
      }),
      createDownloadUrl: vi.fn().mockResolvedValue({
        url: 'https://signed-download',
        expiresAt: new Date('2026-11-06T00:01:00.000Z'),
      }),
      headObject: vi.fn().mockResolvedValue({
        sizeBytes: 2048,
        contentType: 'application/pdf',
        checksumSha256Base64: CHECKSUM_BASE64,
        versionId: 's3-version-1',
      }),
      readObjectPrefix: vi.fn().mockResolvedValue(PDF_PREFIX),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };
    const unitOfWork: IDocumentUnitOfWork = {
      execute: (operation) => operation(transaction),
    };
    const settings: Record<string, number> = {
      DOCUMENT_MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
      DOCUMENT_UPLOAD_URL_TTL_SECONDS: 300,
      DOCUMENT_DOWNLOAD_URL_TTL_SECONDS: 60,
    };
    service = new DocumentService(
      { authorize } as unknown as ContractAccessService,
      persistence,
      unitOfWork,
      storage,
      {
        getOrThrow: (key: string) => settings[key],
      } as unknown as ConfigService,
    );
  });

  const uploadRequest = {
    title: 'Method statement',
    category: EDocumentCategory.REPORT,
    visibility: EDocumentVisibility.PRIVATE,
    fileName: 'method.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    checksumSha256: CHECKSUM,
  };

  describe('createUpload', () => {
    it('creates a pending version under the authorized company namespace', async () => {
      transaction.documents.create.mockResolvedValue(makeDocument());

      const session = await service.createUpload(actor, uploadRequest);

      expect(authorize).toHaveBeenCalledWith(
        'user-1',
        COMPANY,
        CONTRACT,
        'general',
      );
      expect(transaction.documents.create).toHaveBeenCalledWith(scope, {
        title: 'Method statement',
        documentNumber: expect.stringMatching(/^DOC-[0-9A-Z]{26}$/),
        category: EDocumentCategory.REPORT,
        visibility: EDocumentVisibility.PRIVATE,
        status: EDocumentStatus.VERIFICATION_PENDING,
      });
      const presign = storage.createUploadUrl.mock.calls[0][0];
      expect(presign).toMatchObject({
        contentType: 'application/pdf',
        contentLength: 2048,
        checksumSha256Base64: CHECKSUM_BASE64,
        expiresInSeconds: 300,
      });
      expect(presign.key).toMatch(
        new RegExp(
          `^companies/${COMPANY}/contracts/${CONTRACT}/documents/${DOCUMENT}/[0-9A-Z]{26}\\.pdf$`,
        ),
      );
      expect(transaction.versions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: DOCUMENT,
          versionNumber: 1,
          storageKey: presign.key,
          storageProvider: 'amazon-s3',
          storageBucket: 'bucket',
          uploadedById: 'member-1',
          checksumSha256: CHECKSUM,
        }),
      );
      expect(session.upload).toEqual({
        url: 'https://signed-upload',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'x-amz-checksum-sha256': CHECKSUM_BASE64,
        },
        expiresAt: '2026-11-06T00:05:00.000Z',
      });
      expect(session.version.uploadStatus).toBe(
        EDocumentUploadStatus.PENDING_UPLOAD,
      );
      // Neither the storage key nor the bucket is part of the response.
      expect(JSON.stringify(session.document)).not.toContain('companies/');
      const activity = transaction.activity.record.mock.calls[0][0];
      expect(activity).toMatchObject({
        action: 'document.upload_initiated',
        actorCompanyUserId: 'member-1',
        documentId: DOCUMENT,
      });
      expect(JSON.stringify(activity)).not.toContain('signed-upload');
    });

    it('authorizes restricted categories against their contract workspace', async () => {
      transaction.documents.create.mockResolvedValue(
        makeDocument({ category: EDocumentCategory.HSE }),
      );

      await service.createUpload(actor, {
        ...uploadRequest,
        category: EDocumentCategory.HSE,
      });

      expect(authorize).toHaveBeenCalledWith(
        'user-1',
        COMPANY,
        CONTRACT,
        'hse',
      );
    });

    it('rejects an unsupported file before authorizing or storing anything', async () => {
      await expect(
        service.createUpload(actor, {
          ...uploadRequest,
          fileName: 'payload.exe',
          mimeType: 'application/x-msdownload',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(authorize).not.toHaveBeenCalled();
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
    });

    it('denies a user without access to the contract workspace', async () => {
      authorize.mockRejectedValue(
        new ForbiddenException(
          'Your role does not have access to this contract workspace',
        ),
      );

      await expect(
        service.createUpload(actor, uploadRequest),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(transaction.documents.create).not.toHaveBeenCalled();
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
    });

    it('requires an active membership to record the uploader', async () => {
      transaction.memberships.findActive.mockResolvedValue(null);

      await expect(
        service.createUpload(actor, uploadRequest),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe('createVersionUpload', () => {
    it('numbers the new version under a lock on an owned document', async () => {
      persistence.documents.findOwned.mockResolvedValue(makeDocument());
      transaction.documents.findOwnedForUpdate.mockResolvedValue(
        makeDocument(),
      );
      transaction.versions.nextVersionNumber.mockResolvedValue(3);

      const session = await service.createVersionUpload(actor, DOCUMENT, {
        fileName: 'method-rev3.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        checksumSha256: CHECKSUM,
      });

      expect(transaction.documents.findOwnedForUpdate).toHaveBeenCalledWith(
        scope,
        DOCUMENT,
      );
      expect(session.version.versionNumber).toBe(3);
    });

    it('does not let a party add versions to a document it does not own', async () => {
      persistence.documents.findOwned.mockResolvedValue(null);

      await expect(
        service.createVersionUpload(actor, DOCUMENT, {
          fileName: 'a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          checksumSha256: CHECKSUM,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.createUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe('completeUpload', () => {
    beforeEach(() => {
      persistence.documents.findOwned.mockResolvedValue(makeDocument());
      persistence.versions.findForDocument.mockResolvedValue(makeVersion());
    });

    it('verifies the stored object and makes the version available', async () => {
      await service.completeUpload(actor, DOCUMENT, VERSION);

      expect(persistence.versions.claimForProcessing).toHaveBeenCalledWith(
        DOCUMENT,
        VERSION,
      );
      expect(storage.headObject).toHaveBeenCalledWith(makeVersion().storageKey);
      expect(transaction.versions.markAvailable).toHaveBeenCalledWith(VERSION, {
        storageVersionId: 's3-version-1',
        uploadedAt: expect.any(Date),
      });
      expect(transaction.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'document.upload_completed' }),
      );
    });

    it('records later versions as replacements', async () => {
      persistence.versions.findForDocument.mockResolvedValue(
        makeVersion({ versionNumber: 2 }),
      );

      await service.completeUpload(actor, DOCUMENT, VERSION);

      expect(transaction.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'document.version_added' }),
      );
    });

    it('returns an already available upload without verifying it again', async () => {
      persistence.versions.findForDocument.mockResolvedValue(
        makeVersion({ uploadStatus: EDocumentUploadStatus.AVAILABLE }),
      );

      await service.completeUpload(actor, DOCUMENT, VERSION);

      expect(persistence.versions.claimForProcessing).not.toHaveBeenCalled();
      expect(storage.headObject).not.toHaveBeenCalled();
    });

    it('rejects a concurrent completion of the same upload', async () => {
      persistence.versions.claimForProcessing.mockResolvedValue(false);

      await expect(
        service.completeUpload(actor, DOCUMENT, VERSION),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(storage.headObject).not.toHaveBeenCalled();
    });

    it('keeps the upload pending when the object has not arrived yet', async () => {
      storage.headObject.mockResolvedValue(null);

      await expect(
        service.completeUpload(actor, DOCUMENT, VERSION),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(persistence.versions.releaseClaim).toHaveBeenCalledWith(VERSION);
      expect(transaction.versions.markFailed).not.toHaveBeenCalled();
    });

    it('fails an upload whose permission expired without an object', async () => {
      persistence.versions.findForDocument.mockResolvedValue(
        makeVersion({ uploadExpiresAt: new Date(Date.now() - 1000) }),
      );
      storage.headObject.mockResolvedValue(null);

      await expect(
        service.completeUpload(actor, DOCUMENT, VERSION),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(transaction.versions.markFailed).toHaveBeenCalledWith(
        VERSION,
        'upload_not_received',
      );
    });

    it.each([
      [
        'checksum_mismatch',
        () =>
          storage.headObject.mockResolvedValue({
            sizeBytes: 2048,
            contentType: 'application/pdf',
            checksumSha256Base64: 'different',
            versionId: null,
          }),
      ],
      [
        'size_mismatch',
        () =>
          storage.headObject.mockResolvedValue({
            sizeBytes: 9999,
            contentType: 'application/pdf',
            checksumSha256Base64: CHECKSUM_BASE64,
            versionId: null,
          }),
      ],
      [
        'file_signature_mismatch',
        () =>
          storage.readObjectPrefix.mockResolvedValue(
            new TextEncoder().encode('<html><script>'),
          ),
      ],
    ])('rejects and removes an object with %s', async (reason, arrange) => {
      arrange();

      await expect(
        service.completeUpload(actor, DOCUMENT, VERSION),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(transaction.versions.markFailed).toHaveBeenCalledWith(
        VERSION,
        reason,
      );
      expect(transaction.versions.markAvailable).not.toHaveBeenCalled();
      expect(transaction.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'document.upload_failed' }),
      );
      expect(storage.deleteObject).toHaveBeenCalledWith(
        makeVersion().storageKey,
      );
    });

    it('leaves the upload retryable when storage is unavailable', async () => {
      storage.headObject.mockRejectedValue(
        new ServiceUnavailableException('Document storage is unavailable'),
      );

      await expect(
        service.completeUpload(actor, DOCUMENT, VERSION),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(persistence.versions.releaseClaim).toHaveBeenCalledWith(VERSION);
      expect(transaction.versions.markFailed).not.toHaveBeenCalled();
    });

    it('rejects a failed upload instead of verifying it again', async () => {
      persistence.versions.findForDocument.mockResolvedValue(
        makeVersion({ uploadStatus: EDocumentUploadStatus.FAILED }),
      );

      await expect(
        service.completeUpload(actor, DOCUMENT, VERSION),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(persistence.versions.claimForProcessing).not.toHaveBeenCalled();
    });
  });

  describe('reads and downloads', () => {
    const available = makeVersion({
      uploadStatus: EDocumentUploadStatus.AVAILABLE,
    });

    it('looks documents up only inside the scope returned by access control', async () => {
      persistence.documents.findVisible.mockResolvedValue(null);

      await expect(service.get(actor, DOCUMENT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // The repository receives the authorized scope, not raw client input.
      expect(persistence.documents.findVisible).toHaveBeenCalledWith(
        scope,
        DOCUMENT,
      );
    });

    it('denies a contract-restricted document to users outside its workspace', async () => {
      persistence.documents.findVisible.mockResolvedValue(
        makeDocument({ category: EDocumentCategory.INVOICE }),
      );
      authorize.mockImplementation(async (_u, _c, _k, workspace: string) => {
        if (workspace === 'finance') {
          throw new ForbiddenException('No finance role');
        }
        return scope;
      });

      await expect(
        service.createDownloadUrl(actor, DOCUMENT),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.createDownloadUrl).not.toHaveBeenCalled();
    });

    it('issues a short-lived download URL and audits it without the URL', async () => {
      persistence.documents.findVisible.mockResolvedValue(makeDocument());
      persistence.versions.listForDocuments.mockResolvedValue([available]);

      const download = await service.createDownloadUrl(actor, DOCUMENT);

      expect(storage.createDownloadUrl).toHaveBeenCalledWith({
        key: available.storageKey,
        fileName: 'method.pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 60,
      });
      expect(download).toEqual({
        url: 'https://signed-download',
        expiresAt: '2026-11-06T00:01:00.000Z',
        fileName: 'method.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      });
      const activity = persistence.activity.record.mock.calls[0][0];
      expect(activity.action).toBe('document.downloaded');
      expect(JSON.stringify(activity)).not.toContain('signed-download');
    });

    it('never issues a download for an unverified upload', async () => {
      persistence.documents.findVisible.mockResolvedValue(makeDocument());
      persistence.versions.listForDocuments.mockResolvedValue([makeVersion()]);

      await expect(
        service.createDownloadUrl(actor, DOCUMENT, VERSION),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.createDownloadUrl).not.toHaveBeenCalled();
    });

    it("shows another party's shared document without its unfinished uploads", async () => {
      persistence.documents.findVisible.mockResolvedValue(
        makeDocument({
          ownerCompanyId: OTHER_COMPANY,
          visibility: EDocumentVisibility.PUBLIC,
        }),
      );
      persistence.versions.listForDocuments.mockResolvedValue([
        makeVersion({ id: 'pending', versionNumber: 2 }),
        available,
      ]);

      const detail = await service.get(actor, DOCUMENT);

      expect(detail.versions.map(({ id }) => id)).toEqual([VERSION]);
      expect(detail.currentVersion?.id).toBe(VERSION);
    });

    it('lists only categories whose workspaces the user can access', async () => {
      authorize.mockImplementation(async (_u, _c, _k, workspace: string) => {
        if (workspace === 'hse') throw new ForbiddenException('No HSE role');
        return scope;
      });
      persistence.documents.listVisible.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.list(actor, { page: 1, limit: 20 });

      const categories = persistence.documents.listVisible.mock.calls[0][1];
      expect(categories).toContain(EDocumentCategory.INVOICE);
      expect(categories).toContain(EDocumentCategory.REPORT);
      expect(categories).not.toContain(EDocumentCategory.HSE);
    });
  });

  describe('delete', () => {
    it('soft-deletes the record and audits it before removing stored objects', async () => {
      const order: string[] = [];
      persistence.documents.findOwned.mockResolvedValue(makeDocument());
      transaction.documents.softDelete.mockImplementation(async () => {
        order.push('softDelete');
        return true;
      });
      persistence.versions.listForDocuments.mockResolvedValue([
        makeVersion(),
        makeVersion({ id: 'legacy', storageProvider: 'legacy' }),
      ]);
      storage.deleteObject.mockImplementation(async () => {
        order.push('deleteObject');
      });

      await service.delete(actor, DOCUMENT);

      expect(transaction.documents.softDelete).toHaveBeenCalledWith(
        scope,
        DOCUMENT,
        'member-1',
        expect.any(Date),
      );
      expect(transaction.activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'document.deleted' }),
      );
      // Objects from other providers are never touched.
      expect(storage.deleteObject).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['softDelete', 'deleteObject']);
    });

    it("cannot delete another company's document", async () => {
      persistence.documents.findOwned.mockResolvedValue(null);

      await expect(service.delete(actor, DOCUMENT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(transaction.documents.softDelete).not.toHaveBeenCalled();
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('keeps objects when the database deletion fails', async () => {
      persistence.documents.findOwned.mockResolvedValue(makeDocument());
      transaction.documents.softDelete.mockResolvedValue(false);

      await expect(service.delete(actor, DOCUMENT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('still completes when stored objects cannot be removed', async () => {
      persistence.documents.findOwned.mockResolvedValue(makeDocument());
      transaction.documents.softDelete.mockResolvedValue(true);
      persistence.versions.listForDocuments.mockResolvedValue([makeVersion()]);
      storage.deleteObject.mockRejectedValue(
        new ServiceUnavailableException('unavailable'),
      );

      await expect(service.delete(actor, DOCUMENT)).resolves.toBeUndefined();
    });
  });
});
