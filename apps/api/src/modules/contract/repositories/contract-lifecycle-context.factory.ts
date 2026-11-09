import { randomUUID } from 'node:crypto';
import {
  ECompanyStatus,
  ECompanyUserStatus,
} from '@contractflow/contracts-schema';
import { IsNull, LessThanOrEqual, type EntityManager } from 'typeorm';
import type { ITransactionContextFactory } from '../../../common/database/transaction-context.factory.interface';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import { Company } from '../../identity/entities/company.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractPartyInvitation } from '../entities/contract-party-invitation.entity';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../entities/contract-role-invitation.entity';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import { ContractSite } from '../../site-operations/entities/contract-site.entity';
import type {
  IActiveAssignmentCriteria,
  IContractLifecycleContext,
  IContractPartyWithRelations,
} from '../interfaces/contract-lifecycle-persistence.interface';

const CONTRACT_PARTY_IDS_SQL =
  '"contract_party_id" IN (SELECT "id" FROM "contract_party" WHERE "contract_id" = :contractId)';

export class ContractLifecycleContextFactory implements ITransactionContextFactory<IContractLifecycleContext> {
  create(manager: EntityManager): IContractLifecycleContext {
    const companies = manager.getRepository(Company);
    const memberships = manager.getRepository(CompanyUser);
    const contracts = manager.getRepository(Contract);
    const parties = manager.getRepository(ContractParty);
    const workspaces = manager.getRepository(ContractWorkspaceEntity);
    const assignments = manager.getRepository(ContractRoleAssignment);
    const roleInvitations = manager.getRepository(ContractRoleInvitation);
    const invitations = manager.getRepository(ContractPartyInvitation);
    const history = manager.getRepository(ContractStatusHistory);
    const activity = manager.getRepository(ActivityLog);
    const sites = manager.getRepository(ContractSite);

    const activeMembership = {
      status: ECompanyUserStatus.ACTIVE,
      leftAt: IsNull(),
    };
    const assignmentQuery = (criteria: IActiveAssignmentCriteria) =>
      assignments
        .createQueryBuilder('assignment')
        .where('assignment.companyId = :companyId', {
          companyId: criteria.companyId,
        })
        .andWhere('assignment.contractPartyId = :partyId', {
          partyId: criteria.contractPartyId,
        })
        .andWhere('assignment.companyUserId = :companyUserId', {
          companyUserId: criteria.companyUserId,
        })
        .andWhere('assignment.role = :role', { role: criteria.role })
        .andWhere('assignment.revokedAt IS NULL');

    return {
      companies: {
        findActiveForShare: (companyId) =>
          companies.findOne({
            where: { id: companyId, status: ECompanyStatus.ACTIVE },
            lock: { mode: 'pessimistic_read' },
          }),
        findActiveVerifiedByEmail: (email) =>
          companies
            .createQueryBuilder('company')
            .where('LOWER(company.email) = :email', { email })
            .andWhere('company.status = :status', {
              status: ECompanyStatus.ACTIVE,
            })
            .andWhere('company.verifiedAt IS NOT NULL')
            .getMany(),
      },
      memberships: {
        findActive: (userId, companyId) =>
          memberships.findOne({
            where: { userId, companyId, ...activeMembership },
          }),
        findActiveForUpdate: (userId, companyId) =>
          memberships.findOne({
            where: { userId, companyId, ...activeMembership },
            lock: { mode: 'pessimistic_write' },
          }),
      },
      contracts: {
        findPermissionSnapshot: (contractId) =>
          contracts.findOne({
            where: { id: contractId },
            select: { id: true, createdByCompanyId: true, deletedAt: true },
          }),
        findForUpdate: (contractId) =>
          contracts.findOne({
            where: { id: contractId },
            lock: { mode: 'pessimistic_write' },
          }),
        findActiveForUpdate: (contractId) =>
          contracts.findOne({
            where: { id: contractId, deletedAt: IsNull() },
            lock: { mode: 'pessimistic_write' },
          }),
        findActiveById: (contractId) =>
          contracts.findOne({ where: { id: contractId, deletedAt: IsNull() } }),
        create: (data) => contracts.save(contracts.create(data)),
        save: (contract) => contracts.save(contract),
        parentWouldCreateCycle: async (parentContractId, contractId) => {
          const rows = (await manager.query(
            `
              WITH RECURSIVE parent_chain("id", "parent_contract_id") AS (
                SELECT "id", "parent_contract_id"
                FROM "contract"
                WHERE "id" = $1 AND "deleted_at" IS NULL
                UNION ALL
                SELECT parent."id", parent."parent_contract_id"
                FROM "contract" AS parent
                INNER JOIN parent_chain AS chain
                  ON parent."id" = chain."parent_contract_id"
                WHERE parent."deleted_at" IS NULL
              )
              SELECT EXISTS (
                SELECT 1 FROM parent_chain WHERE "id" = $2
              ) AS "found"
            `,
            [parentContractId, contractId],
          )) as Array<{ found: boolean }>;
          return rows[0]?.found === true;
        },
      },
      parties: {
        find: (contractId, companyId) =>
          parties.findOne({ where: { contractId, companyId } }),
        findForShare: (contractId, companyId) =>
          parties.findOne({
            where: { contractId, companyId },
            lock: { mode: 'pessimistic_read' },
          }),
        findByIdWithContractAndCompany: (partyId) =>
          parties.findOne({
            where: { id: partyId },
            relations: { contract: true, company: true },
          }) as Promise<IContractPartyWithRelations | null>,
        findById: (partyId) => parties.findOne({ where: { id: partyId } }),
        findForUpdate: (contractId, companyId) =>
          parties.findOne({
            where: { contractId, companyId },
            lock: { mode: 'pessimistic_write' },
          }),
        save: (party) => parties.save(party),
        create: async (data) =>
          parties.save(
            parties.create({
              ...data,
              signatoryFirstName: null,
              signatoryLastName: null,
              signatoryTitle: null,
              signedAt: null,
            }),
          ),
      },
      workspaces: {
        listWorkspaces: async (contractId) =>
          (await workspaces.find({ where: { contractId } })).map(
            ({ workspace }) => workspace,
          ),
        addMany: async (contractId, items, createdByCompanyUserId) => {
          await workspaces.save(
            items.map((workspace) =>
              workspaces.create({
                contractId,
                workspace,
                createdByCompanyUserId,
              }),
            ),
          );
        },
        remove: async (contractId, workspace) => {
          await workspaces.delete({ contractId, workspace });
        },
      },
      roleAssignments: {
        hasActiveAssignment: async (criteria) =>
          Boolean(await assignmentQuery(criteria).getOne()),
        hasActiveAssignmentForShare: async (criteria) =>
          Boolean(
            await assignmentQuery(criteria)
              .setLock('pessimistic_read')
              .getOne(),
          ),
        revokeForWorkspaceRoles: async (
          contractId,
          roles,
          revokedById,
          now,
        ) => {
          await assignments
            .createQueryBuilder()
            .update()
            .set({ revokedAt: now, revokedById, updatedAt: now })
            .where(CONTRACT_PARTY_IDS_SQL, { contractId })
            .andWhere('"contract_role" IN (:...roles)', { roles })
            .andWhere('"revoked_at" IS NULL')
            .execute();
        },
        revokeAllForContract: async (contractId, revokedById, now) => {
          await assignments
            .createQueryBuilder()
            .update()
            .set({ revokedAt: now, revokedById, updatedAt: now })
            .where(CONTRACT_PARTY_IDS_SQL, { contractId })
            .andWhere('"revoked_at" IS NULL')
            .execute();
        },
      },
      roleInvitations: {
        revokePendingForWorkspace: async (contractId, workspace, now) => {
          await roleInvitations
            .createQueryBuilder()
            .update()
            .set({ status: 'revoked', revokedAt: now, updatedAt: now })
            .where(CONTRACT_PARTY_IDS_SQL, { contractId })
            .andWhere('"workspace" = :workspace', { workspace })
            .andWhere('"status" = :pending', { pending: 'pending' })
            .execute();
        },
        revokeAllPendingForContract: async (contractId, now) => {
          await roleInvitations
            .createQueryBuilder()
            .update()
            .set({ status: 'revoked', revokedAt: now, updatedAt: now })
            .where(CONTRACT_PARTY_IDS_SQL, { contractId })
            .andWhere('"status" = :pending', { pending: 'pending' })
            .execute();
        },
      },
      partyInvitations: {
        expirePendingBySource: async (sourcePartyId, now) => {
          await invitations.update(
            {
              sourceContractPartyId: sourcePartyId,
              status: 'pending',
              expiresAt: LessThanOrEqual(now),
            },
            { status: 'expired' },
          );
        },
        expireDuplicatePending: async (criteria, now) => {
          await invitations.update(
            {
              sourceContractPartyId: criteria.sourcePartyId,
              targetCompanyId: criteria.targetCompanyId,
              partyType: criteria.partyType,
              status: 'pending',
              expiresAt: LessThanOrEqual(now),
            },
            { status: 'expired' },
          );
        },
        findPendingDuplicate: (criteria) =>
          invitations.findOne({
            where: {
              sourceContractPartyId: criteria.sourcePartyId,
              targetCompanyId: criteria.targetCompanyId,
              partyType: criteria.partyType,
              status: 'pending',
            },
          }),
        listBySource: (sourcePartyId) =>
          invitations.find({
            where: { sourceContractPartyId: sourcePartyId },
            order: { createdAt: 'DESC', id: 'ASC' },
          }),
        findBySourceAndIdForUpdate: (invitationId, sourcePartyId) =>
          invitations.findOne({
            where: { id: invitationId, sourceContractPartyId: sourcePartyId },
            lock: { mode: 'pessimistic_write' },
          }),
        listPendingForTarget: async (targetCompanyId, now) => {
          const rows = await invitations
            .createQueryBuilder('invitation')
            .innerJoin(
              ContractParty,
              'source',
              'source.id = invitation.sourceContractPartyId',
            )
            .innerJoin(Contract, 'contract', 'contract.id = source.contractId')
            .innerJoin(Company, 'inviter', 'inviter.id = source.companyId')
            .where('invitation.targetCompanyId = :targetCompanyId', {
              targetCompanyId,
            })
            .andWhere('invitation.status = :pending', { pending: 'pending' })
            .andWhere('invitation.revokedAt IS NULL')
            .andWhere('invitation.expiresAt > :now', { now })
            .andWhere('contract.deletedAt IS NULL')
            .select('invitation.id', 'id')
            .addSelect('invitation.partyType', 'partyType')
            .addSelect('invitation.email', 'email')
            .addSelect('invitation.createdAt', 'createdAt')
            .addSelect('invitation.expiresAt', 'expiresAt')
            .addSelect('contract.title', 'contractTitle')
            .addSelect('contract.referenceNumber', 'contractReference')
            .addSelect('inviter.name', 'invitingCompanyName')
            .orderBy('invitation.createdAt', 'DESC')
            .addOrderBy('invitation.id', 'ASC')
            .getRawMany<{
              id: string;
              partyType: ContractPartyInvitation['partyType'];
              email: string;
              createdAt: Date | string;
              expiresAt: Date | string;
              contractTitle: string;
              contractReference: string;
              invitingCompanyName: string;
            }>();
          return rows.map((row) => ({
            ...row,
            createdAt: new Date(row.createdAt),
            expiresAt: new Date(row.expiresAt),
          }));
        },
        findByIdForTarget: (invitationId, targetCompanyId) =>
          invitations.findOne({ where: { id: invitationId, targetCompanyId } }),
        findByIdForTargetForUpdate: (invitationId, targetCompanyId) =>
          invitations.findOne({
            where: { id: invitationId, targetCompanyId },
            lock: { mode: 'pessimistic_write' },
          }),
        findByTokenHash: (tokenHash) =>
          invitations.findOne({ where: { tokenHash } }),
        findByTokenHashForUpdate: (tokenHash) =>
          invitations
            .createQueryBuilder('invitation')
            .where('invitation.tokenHash = :tokenHash', { tokenHash })
            .setLock('pessimistic_write')
            .getOne(),
        expireIfPending: async (invitationId) => {
          await invitations.update(
            { id: invitationId, status: 'pending' },
            { status: 'expired' },
          );
        },
        revokePendingBySource: async (sourcePartyId, now) => {
          await invitations.update(
            { sourceContractPartyId: sourcePartyId, status: 'pending' },
            { status: 'revoked', revokedAt: now },
          );
        },
        create: (data) => invitations.save(invitations.create(data)),
        save: (invitation) => invitations.save(invitation),
      },
      sites: {
        listByContract: (contractId) =>
          sites.find({
            where: { contractId },
            order: { name: 'ASC', id: 'ASC' },
          }),
        findForUpdate: (contractId, siteId) =>
          sites.findOne({
            where: { id: siteId, contractId },
            lock: { mode: 'pessimistic_write' },
          }),
        findByCode: (contractId, siteCode) =>
          sites.findOne({ where: { contractId, siteCode } }),
        create: (data) => sites.save(sites.create(data)),
        save: (site) => sites.save(site),
      },
      statusHistory: {
        record: async (data) => {
          await history.save(history.create(data));
        },
      },
      activity: {
        record: async (data) => {
          await activity.save(
            activity.create({
              contractId: data.contractId,
              companyId: data.companyId,
              actorUserId: data.actorUserId,
              action: data.action,
              entityType: 'contract',
              entityId: randomUUID(),
              summary: data.summary,
              changes: { before: null, after: data.changes },
              metadata: {},
              ipAddress: null,
              userAgent: null,
              requestId: null,
              occurredAt: data.occurredAt,
            }),
          );
        },
      },
    };
  }
}
