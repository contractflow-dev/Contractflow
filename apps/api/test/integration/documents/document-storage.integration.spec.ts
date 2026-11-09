import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  EDocumentCategory,
  EDocumentUploadStatus,
  EDocumentVisibility,
} from '@contractflow/contracts-schema';
import { In, type DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import type { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { ActivityLog } from '../../../src/modules/cross-cutting/entities/activity-log.entity';
import { Document } from '../../../src/modules/cross-cutting/entities/document.entity';
import { DocumentVersion } from '../../../src/modules/cross-cutting/entities/document-version.entity';
import {
  DocumentContextFactory,
  TypeOrmDocumentContext,
} from '../../../src/modules/cross-cutting/repositories/document-context.factory';
import { DocumentService } from '../../../src/modules/cross-cutting/services/document.service';
import {
  ContractTestFactory,
  type LifecycleFixture,
} from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import { InMemoryObjectStorage } from './in-memory-object-storage';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n');

describe('Document storage PostgreSQL integration', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let storage: InMemoryObjectStorage;
  let service: DocumentService;
  let fixture: LifecycleFixture;

  const actorFor = (companyId: string, userId: string) => ({
    userId,
    companyId,
    contractId: fixture.contract.id,
  });

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
  }, 60_000);

  beforeEach(async () => {
    fixture = await factory!.createLifecycleFixture();
    storage = new InMemoryObjectStorage();
    // Authorization is unit-tested; here the gate returns the caller's scope.
    const access = {
      authorizeIncludingArchived: async (
        _user: string,
        companyId: string,
        contractId: string,
      ) => ({
        scope: Object.freeze({ companyId, contractId }),
        archived: false,
      }),
    } as unknown as ContractAccessService;
    const settings: Record<string, number> = {
      DOCUMENT_MAX_UPLOAD_BYTES: 1024 * 1024,
      DOCUMENT_UPLOAD_URL_TTL_SECONDS: 300,
      DOCUMENT_DOWNLOAD_URL_TTL_SECONDS: 60,
    };
    service = new DocumentService(
      access,
      new TypeOrmDocumentContext(dataSource!.manager),
      new TypeOrmUnitOfWork(dataSource!, new DocumentContextFactory()),
      storage,
      {
        getOrThrow: (key: string) => settings[key],
      } as unknown as ConfigService,
    );
  });

  afterEach(async () => {
    // document_version -> document is NO ACTION, so remove versions first.
    const documents = await dataSource!.getRepository(Document).find({
      where: { contractId: fixture.contract.id },
      select: { id: true },
    });
    const ids = documents.map(({ id }) => id);
    if (ids.length) {
      await dataSource!
        .getRepository(DocumentVersion)
        .delete({ documentId: In(ids) });
      await dataSource!.getRepository(Document).delete({ id: In(ids) });
    }
    await factory?.cleanup();
  });

  afterAll(async () => {
    try {
      await factory?.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  async function uploadPdf(
    visibility = EDocumentVisibility.PRIVATE,
    body: Buffer = PDF,
  ) {
    const session = await service.createUpload(
      actorFor(fixture.company.id, fixture.actor.userId),
      {
        title: 'Method statement',
        category: EDocumentCategory.REPORT,
        visibility,
        fileName: 'method.pdf',
        mimeType: 'application/pdf',
        sizeBytes: body.length,
        checksumSha256: createHash('sha256').update(body).digest('hex'),
      },
    );
    const version = await dataSource!
      .getRepository(DocumentVersion)
      .findOneByOrFail({ id: session.version.id });
    storage.put(version.storageKey, body, 'application/pdf');
    return { session, version };
  }

  it('persists a pending upload, then verifies and publishes it', async () => {
    const { session, version } = await uploadPdf();

    expect(version).toMatchObject({
      uploadStatus: EDocumentUploadStatus.PENDING_UPLOAD,
      storageProvider: 'amazon-s3',
      storageBucket: 'integration-bucket',
      sizeBytes: PDF.length,
      uploadedById: fixture.actor.id,
    });
    expect(version.storageKey).toBe(
      `companies/${fixture.company.id}/contracts/${fixture.contract.id}/documents/${session.document.id}/${version.id}.pdf`,
    );
    expect(session.document.currentVersion).toBeNull();

    const detail = await service.completeUpload(
      actorFor(fixture.company.id, fixture.actor.userId),
      session.document.id,
      version.id,
    );

    expect(detail.currentVersion).toMatchObject({
      id: version.id,
      uploadStatus: EDocumentUploadStatus.AVAILABLE,
      sizeBytes: PDF.length,
    });
    const stored = await dataSource!
      .getRepository(DocumentVersion)
      .findOneByOrFail({ id: version.id });
    expect(stored.storageVersionId).toBe('memory-version-1');
    const actions = (
      await dataSource!.getRepository(ActivityLog).find({
        where: { contractId: fixture.contract.id, entityType: 'document' },
        order: { occurredAt: 'ASC' },
      })
    ).map(({ action }) => action);
    expect(actions).toEqual([
      'document.upload_initiated',
      'document.upload_completed',
    ]);
  });

  it('fails and removes an object whose content is not the declared type', async () => {
    // A matching checksum and size, but HTML bytes behind a .pdf name.
    const html = Buffer.from('<html><script>alert(1)</script></html>\n');
    const { session, version } = await uploadPdf(
      EDocumentVisibility.PRIVATE,
      html,
    );

    await expect(
      service.completeUpload(
        actorFor(fixture.company.id, fixture.actor.userId),
        session.document.id,
        version.id,
      ),
    ).rejects.toThrow('could not be verified');

    const stored = await dataSource!
      .getRepository(DocumentVersion)
      .findOneByOrFail({ id: version.id });
    expect(stored.uploadStatus).toBe(EDocumentUploadStatus.FAILED);
    expect(stored.failureReason).toBe('file_signature_mismatch');
    expect(storage.objects.has(version.storageKey)).toBe(false);
  });

  it('isolates private documents and shares public ones with contract parties', async () => {
    const other = await factory!.createCompanyMember();
    await factory!.createAdditionalParty(fixture.contract, other.company);
    const otherActor = actorFor(other.company.id, other.member.userId);

    const privateDoc = await uploadPdf(EDocumentVisibility.PRIVATE);
    const publicDoc = await uploadPdf(EDocumentVisibility.PUBLIC);
    for (const { session, version } of [privateDoc, publicDoc]) {
      await service.completeUpload(
        actorFor(fixture.company.id, fixture.actor.userId),
        session.document.id,
        version.id,
      );
    }

    await expect(
      service.get(otherActor, privateDoc.session.document.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.get(otherActor, publicDoc.session.document.id),
    ).resolves.toMatchObject({ id: publicDoc.session.document.id });
    const listed = await service.list(otherActor, { page: 1, limit: 20 });
    expect(listed.data.map(({ id }) => id)).toEqual([
      publicDoc.session.document.id,
    ]);
    // Shared documents are read-only for other parties.
    await expect(
      service.delete(otherActor, publicDoc.session.document.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes documents, hides them, and removes their objects', async () => {
    const { session, version } = await uploadPdf();
    await service.completeUpload(
      actorFor(fixture.company.id, fixture.actor.userId),
      session.document.id,
      version.id,
    );

    await service.delete(
      actorFor(fixture.company.id, fixture.actor.userId),
      session.document.id,
    );

    const row = await dataSource!
      .getRepository(Document)
      .findOneByOrFail({ id: session.document.id });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(row.deletedById).toBe(fixture.actor.id);
    expect(storage.objects.has(version.storageKey)).toBe(false);
    await expect(
      service.get(
        actorFor(fixture.company.id, fixture.actor.userId),
        session.document.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('enforces one row per version number and one claim per upload', async () => {
    const { session, version } = await uploadPdf();
    const repository = dataSource!.getRepository(DocumentVersion);

    await expect(
      repository.insert({
        ...version,
        id: '01J0000000000000000000DUPE',
        storageKey: `${version.storageKey}.dupe`,
      }),
    ).rejects.toThrow(/duplicate key/);

    const context = new TypeOrmDocumentContext(dataSource!.manager);
    await expect(
      context.versions.claimForProcessing(session.document.id, version.id),
    ).resolves.toBe(true);
    await expect(
      context.versions.claimForProcessing(session.document.id, version.id),
    ).resolves.toBe(false);
  });
});
