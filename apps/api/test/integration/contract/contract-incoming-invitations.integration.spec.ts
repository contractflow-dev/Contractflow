import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ECompanyRole, EPartyType } from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { ContractPartyInvitation } from '../../../src/modules/contract/entities/contract-party-invitation.entity';
import { ContractParty } from '../../../src/modules/contract/entities/contract-party.entity';
import { Contract } from '../../../src/modules/contract/entities/contract.entity';
import { ContractLifecycleContextFactory } from '../../../src/modules/contract/repositories/contract-lifecycle-context.factory';
import { ContractLifecycleService } from '../../../src/modules/contract/services/contract-lifecycle.service';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import type { Company } from '../../../src/modules/identity/entities/company.entity';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

/**
 * Contract invitations answered in the app (story CA 14): a company sees
 * only invitations addressed to it, only its Company Administrators can
 * answer, and an answer is final.
 */
describe('Incoming contract invitations (PostgreSQL)', () => {
  let dataSource: DataSource | undefined;
  let factory: ContractTestFactory | undefined;
  let service: ContractLifecycleService;

  let contract: Contract;
  let client: Company;
  let clientAdmin: CompanyUser;
  let invitee: Company;
  let inviteeAdmin: CompanyUser;
  let inviteeMember: CompanyUser;
  let outsider: Company;
  let outsiderAdmin: CompanyUser;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    const mail = {
      sendContractPartyInvitationEmail: async () => undefined,
    } as unknown as MailService;
    service = new ContractLifecycleService(
      new TypeOrmUnitOfWork(dataSource, new ContractLifecycleContextFactory()),
      mail,
    );
  }, 60_000);

  beforeEach(async () => {
    const fixture = await factory!.createRoleAssignmentFixture();
    contract = fixture.contract;
    client = fixture.company;
    clientAdmin = fixture.actor;
    ({ company: invitee, member: inviteeAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN));
    inviteeMember = await factory!.createAdditionalMember(invitee);
    ({ company: outsider, member: outsiderAdmin } =
      await factory!.createCompanyMember(ECompanyRole.COMPANY_ADMIN));
  });

  afterEach(async () => {
    await factory?.cleanup();
  });

  afterAll(async () => {
    try {
      await factory?.cleanup();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  const invite = () =>
    service.inviteCompany(clientAdmin.userId, client.id, contract.id, {
      email: invitee.email,
      partyType: EPartyType.CONTRACTOR,
    });
  const listFor = (member: CompanyUser) =>
    service.listIncomingInvitations(member.userId, member.companyId);
  const respond = (
    member: CompanyUser,
    invitationId: string,
    decision: 'accept' | 'reject',
  ) =>
    service.respondToIncomingInvitation(
      member.userId,
      member.companyId,
      invitationId,
      decision,
    );
  const partyOf = (company: Company) =>
    dataSource!
      .getRepository(ContractParty)
      .findOneBy({ contractId: contract.id, companyId: company.id });

  it('lists an invitation only for the company it is addressed to', async () => {
    const { id } = await invite();

    await expect(listFor(inviteeAdmin)).resolves.toEqual([
      expect.objectContaining({
        id,
        contractTitle: contract.title,
        contractReference: contract.referenceNumber,
        invitingCompanyName: client.name,
        partyType: EPartyType.CONTRACTOR,
        email: invitee.email,
      }),
    ]);
    await expect(listFor(outsiderAdmin)).resolves.toEqual([]);
    await expect(listFor(clientAdmin)).resolves.toEqual([]);
    // Only Company Administrators answer invitations, so only they list them.
    await expect(listFor(inviteeMember)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses answers from other companies and from non-administrators', async () => {
    const { id } = await invite();

    // Another company can't find it, whoever asks.
    await expect(respond(outsiderAdmin, id, 'accept')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(respond(clientAdmin, id, 'accept')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(respond(inviteeMember, id, 'accept')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await partyOf(outsider)).toBeNull();
    expect(await partyOf(invitee)).toBeNull();
  });

  it('accepts once: the company joins the contract and the answer is final', async () => {
    const { id } = await invite();

    await expect(respond(inviteeAdmin, id, 'accept')).resolves.toEqual({
      status: 'accepted',
    });
    await expect(partyOf(invitee)).resolves.toMatchObject({
      partyType: EPartyType.CONTRACTOR,
    });
    await expect(respond(inviteeAdmin, id, 'reject')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(listFor(inviteeAdmin)).resolves.toEqual([]);
  });

  it('rejects without adding the company to the contract', async () => {
    const { id } = await invite();

    await expect(respond(inviteeAdmin, id, 'reject')).resolves.toEqual({
      status: 'rejected',
    });
    expect(await partyOf(invitee)).toBeNull();
    await expect(
      dataSource!
        .getRepository(ContractPartyInvitation)
        .findOneByOrFail({ id }),
    ).resolves.toMatchObject({ status: 'rejected' });
  });

  it('hides expired invitations and those on archived contracts', async () => {
    const { id } = await invite();
    const invitations = dataSource!.getRepository(ContractPartyInvitation);

    await invitations.update(
      { id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    await expect(listFor(inviteeAdmin)).resolves.toEqual([]);
    await expect(respond(inviteeAdmin, id, 'accept')).rejects.toThrow(
      'This contract invitation has expired.',
    );
    expect(await partyOf(invitee)).toBeNull();

    const second = await invite();
    await dataSource!
      .getRepository(Contract)
      .update({ id: contract.id }, { deletedAt: new Date() });
    await expect(listFor(inviteeAdmin)).resolves.toEqual([]);
    await expect(
      respond(inviteeAdmin, second.id, 'accept'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
