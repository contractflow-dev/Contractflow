import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  ECompanyRole,
  EContractRole,
  EDocumentCategory,
  EDocumentStatus,
  EDocumentVisibility,
} from '@contractflow/contracts-schema';
import { In, type DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { ContractRoleAssignment } from '../../../src/modules/contract/entities/contract-role-assignment.entity';
import { ContractWorkspaceEntity } from '../../../src/modules/contract/entities/contract-workspace.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractPartyRepository } from '../../../src/modules/contract/repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from '../../../src/modules/contract/repositories/contract-role-assignment.repository';
import { ContractWorkspaceRepository } from '../../../src/modules/contract/repositories/contract-workspace.repository';
import { ContractRepository } from '../../../src/modules/contract/repositories/contract.repository';
import { ContractAccessService } from '../../../src/modules/contract/services/contract-access.service';
import { Document } from '../../../src/modules/cross-cutting/entities/document.entity';
import { DocumentVersion } from '../../../src/modules/cross-cutting/entities/document-version.entity';
import {
  DocumentContextFactory,
  TypeOrmDocumentContext,
} from '../../../src/modules/cross-cutting/repositories/document-context.factory';
import {
  DocumentService,
  type ICompanyDocumentActor,
  type IDocumentActor,
} from '../../../src/modules/cross-cutting/services/document.service';
import { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import { CompanyUserRepository } from '../../../src/modules/identity/repositories/company-user.respository';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';
import { InMemoryObjectStorage } from './in-memory-object-storage';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n');
const checksum = createHash('sha256').update(PDF).digest('hex');
const file = {
  fileName: 'policy.pdf',
  mimeType: 'application/pdf',
  sizeBytes: PDF.length,
  checksumSha256: checksum,
};

/**
 * Document visibility across companies, with the real contract access
 * checks and PostgreSQL:
 *
 * 1. Company-wide documents: only members of the owning company.
 * 2. "All parties" contract documents: role holders of every party company.
 * 3. "Your company only" contract documents: the uploading company only.
 * 4. Archived contracts: readable as above, but read-only.
 */
describe('Document access across companies (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let storage: InMemoryObjectStorage;
  let service: DocumentService;

  // Company A (the client) and company B (a counterparty on the same
  // contract), plus company O, which is not a party.
  let companyA: Company;
  let companyB: Company;
  let companyO: Company;
  let contract: Contract;
  let memberA: CompanyUser; // Contractor Project Lead role on the contract
  let adminA: CompanyUser; // Company Administrator, no contract role
  let memberB: CompanyUser; // Contractor Project Lead role on the contract
  let adminB: CompanyUser; // Company Administrator, no contract role
  let adminO: CompanyUser;

  const inContract = (member: CompanyUser): IDocumentActor => ({
    userId: member.userId,
    companyId: member.companyId,
    contractId: contract.id,
  });
  const inCompany = (member: CompanyUser): ICompanyDocumentActor => ({
    userId: member.userId,
    companyId: member.companyId,
  });

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
  }, 60_000);

  beforeEach(async () => {
    const ds = dataSource!;
    const fixture = await factory!.createLifecycleFixture();
    companyA = fixture.company;
    contract = fixture.contract;
    memberA = fixture.actor;
    adminA = await factory!.createAdditionalMember(
      companyA,
      ECompanyRole.COMPANY_ADMIN,
    );

    ({ company: companyB, member: adminB } = await factory!.createCompanyMember(
      ECompanyRole.COMPANY_ADMIN,
    ));
    const partyB = await factory!.createAdditionalParty(contract, companyB);
    memberB = await factory!.createAdditionalMember(companyB);
    const assignments = ds.getRepository(ContractRoleAssignment);
    await assignments.save(
      assignments.create({
        contractPartyId: partyB.id,
        companyUserId: memberB.id,
        companyId: companyB.id,
        role: EContractRole.CONTRACTOR_PROJECT_LEAD,
        isWorkspaceAdmin: false,
        assignedAt: new Date(),
        assignedById: memberB.id,
        revokedAt: null,
        revokedById: null,
      }),
    );
    ({ company: companyO, member: adminO } = await factory!.createCompanyMember(
      ECompanyRole.COMPANY_ADMIN,
    ));

    storage = new InMemoryObjectStorage();
    const access = new ContractAccessService(
      new CompanyUserRepository(ds.getRepository(CompanyUser)),
      new ContractPartyRepository(ds.getRepository(ContractParty)),
      new ContractRoleAssignmentRepository(assignments),
      new ContractRepository(ds.getRepository(Contract)),
      new ContractWorkspaceRepository(
        ds.getRepository(ContractWorkspaceEntity),
        ds.getRepository(ContractParty),
      ),
    );
    const settings: Record<string, number> = {
      DOCUMENT_MAX_UPLOAD_BYTES: 1024 * 1024,
      DOCUMENT_UPLOAD_URL_TTL_SECONDS: 300,
      DOCUMENT_DOWNLOAD_URL_TTL_SECONDS: 60,
    };
    service = new DocumentService(
      access,
      new TypeOrmDocumentContext(ds.manager),
      new TypeOrmUnitOfWork(ds, new DocumentContextFactory()),
      storage,
      {
        getOrThrow: (key: string) => settings[key],
      } as unknown as ConfigService,
    );
  });

  afterEach(async () => {
    // document_version -> document is NO ACTION: remove versions first.
    const documents = await dataSource!.getRepository(Document).find({
      where: { ownerCompanyId: In([companyA.id, companyB.id, companyO.id]) },
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

  async function companyDocument(admin: CompanyUser, title: string) {
    const session = await service.createCompanyUpload(inCompany(admin), {
      ...file,
      title,
      category: EDocumentCategory.CERTIFICATE,
    });
    const version = await dataSource!
      .getRepository(DocumentVersion)
      .findOneByOrFail({ id: session.version.id });
    storage.put(version.storageKey, PDF, 'application/pdf');
    await service.completeCompanyUpload(
      inCompany(admin),
      session.document.id,
      version.id,
    );
    return { documentId: session.document.id, version };
  }

  async function contractDocument(
    member: CompanyUser,
    title: string,
    visibility: EDocumentVisibility,
  ) {
    const session = await service.createUpload(inContract(member), {
      ...file,
      title,
      category: EDocumentCategory.REPORT,
      visibility,
    });
    const version = await dataSource!
      .getRepository(DocumentVersion)
      .findOneByOrFail({ id: session.version.id });
    storage.put(version.storageKey, PDF, 'application/pdf');
    await service.completeUpload(
      inContract(member),
      session.document.id,
      version.id,
    );
    return { documentId: session.document.id, version };
  }

  it("keeps a company's library private, even from companies it shares contracts with", async () => {
    const { documentId, version } = await companyDocument(
      adminA,
      'Insurance master policy',
    );
    expect(version.storageKey).toBe(
      `companies/${companyA.id}/documents/${documentId}/${version.id}.pdf`,
    );

    // Any active member of company A can read it.
    const ownList = await service.listCompany(inCompany(memberA), {
      page: 1,
      limit: 20,
    });
    expect(ownList.data.map(({ id }) => id)).toEqual([documentId]);
    expect(ownList.data[0]).toMatchObject({
      contractId: null,
      visibility: EDocumentVisibility.PRIVATE,
    });
    await expect(
      service.createCompanyDownloadUrl(inCompany(memberA), documentId),
    ).resolves.toMatchObject({ fileName: 'policy.pdf' });

    // Company B shares a contract with A, and still can't reach it.
    const otherList = await service.listCompany(inCompany(adminB), {
      page: 1,
      limit: 20,
    });
    expect(otherList.data).toEqual([]);
    for (const attempt of [
      () => service.getCompany(inCompany(adminB), documentId),
      () => service.createCompanyDownloadUrl(inCompany(adminB), documentId),
      () => service.deleteCompany(inCompany(adminB), documentId),
      () =>
        service.createCompanyVersionUpload(inCompany(adminB), documentId, file),
      // Nor through the shared contract's document routes.
      () => service.get(inContract(memberB), documentId),
      () => service.createDownloadUrl(inContract(memberB), documentId),
      () => service.get(inContract(memberA), documentId),
    ]) {
      await expect(attempt()).rejects.toBeInstanceOf(NotFoundException);
    }
    const contractList = await service.list(inContract(memberA), {
      page: 1,
      limit: 20,
    });
    expect(contractList.data.map(({ id }) => id)).not.toContain(documentId);
  });

  it('requires company membership to read and administrator rights to change', async () => {
    const { documentId } = await companyDocument(adminA, 'HSE manual');

    // A user acting for a company they don't belong to.
    await expect(
      service.listCompany(
        { userId: adminO.userId, companyId: companyA.id },
        { page: 1, limit: 20 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // A member who is not a Company Administrator.
    for (const attempt of [
      () =>
        service.createCompanyUpload(inCompany(memberA), {
          ...file,
          title: 'Unofficial copy',
          category: EDocumentCategory.OTHER,
        }),
      () =>
        service.createCompanyVersionUpload(
          inCompany(memberA),
          documentId,
          file,
        ),
      () => service.deleteCompany(inCompany(memberA), documentId),
    ]) {
      await expect(attempt()).rejects.toBeInstanceOf(ForbiddenException);
    }

    await service.deleteCompany(inCompany(adminA), documentId);
    await expect(
      service.getCompany(inCompany(memberA), documentId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a shared company-wide document in the database itself', async () => {
    const repository = dataSource!.getRepository(Document);
    await expect(
      repository.save(
        repository.create({
          contractId: null,
          ownerCompanyId: companyA.id,
          title: 'Shared by mistake',
          documentNumber: 'DOC-SHARED',
          category: EDocumentCategory.OTHER,
          visibility: EDocumentVisibility.PUBLIC,
          status: EDocumentStatus.VALID,
          deletedAt: null,
          deletedById: null,
        }),
      ),
    ).rejects.toThrow(/ck_document_company_level_private/);
  });

  it('shares "All parties" contract documents with role holders of every party only', async () => {
    const shared = await contractDocument(
      memberA,
      'Hydrotest procedure',
      EDocumentVisibility.PUBLIC,
    );
    const own = await contractDocument(
      memberA,
      'Internal cost plan',
      EDocumentVisibility.PRIVATE,
    );

    // The counterparty's role holder sees the shared document only.
    const listB = await service.list(inContract(memberB), {
      page: 1,
      limit: 20,
    });
    expect(listB.data.map(({ id }) => id)).toEqual([shared.documentId]);
    await expect(
      service.createDownloadUrl(inContract(memberB), shared.documentId),
    ).resolves.toMatchObject({ fileName: 'policy.pdf' });
    await expect(
      service.get(inContract(memberB), own.documentId),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Seeing a shared document doesn't let the counterparty change it.
    for (const attempt of [
      () => service.delete(inContract(memberB), shared.documentId),
      () =>
        service.createVersionUpload(
          inContract(memberB),
          shared.documentId,
          file,
        ),
    ]) {
      await expect(attempt()).rejects.toBeInstanceOf(NotFoundException);
    }

    // Without a role on the contract, a party's administrator is refused.
    await expect(
      service.list(inContract(adminB), { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // A company that is not a party can't find the contract at all.
    await expect(
      service.list(inContract(adminO), { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps documents of an archived contract readable but read-only', async () => {
    const shared = await contractDocument(
      memberA,
      'As-built drawings',
      EDocumentVisibility.PUBLIC,
    );
    await dataSource!
      .getRepository(Contract)
      .update({ id: contract.id }, { deletedAt: new Date() });

    const listA = await service.list(inContract(memberA), {
      page: 1,
      limit: 20,
    });
    expect(listA.data.map(({ id }) => id)).toEqual([shared.documentId]);
    const listB = await service.list(inContract(memberB), {
      page: 1,
      limit: 20,
    });
    expect(listB.data.map(({ id }) => id)).toEqual([shared.documentId]);
    await expect(
      service.createDownloadUrl(inContract(memberB), shared.documentId),
    ).resolves.toMatchObject({ fileName: 'policy.pdf' });

    for (const attempt of [
      () =>
        service.createUpload(inContract(memberA), {
          ...file,
          title: 'Late addition',
          category: EDocumentCategory.REPORT,
          visibility: EDocumentVisibility.PUBLIC,
        }),
      () =>
        service.createVersionUpload(
          inContract(memberA),
          shared.documentId,
          file,
        ),
      () => service.delete(inContract(memberA), shared.documentId),
    ]) {
      await expect(attempt()).rejects.toBeInstanceOf(ConflictException);
    }
    const stillThere = await dataSource!
      .getRepository(Document)
      .findOneByOrFail({ id: shared.documentId });
    expect(stillThere.deletedAt).toBeNull();
    // An archived contract still hides everything from non-parties.
    await expect(
      service.list(inContract(adminO), { page: 1, limit: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
