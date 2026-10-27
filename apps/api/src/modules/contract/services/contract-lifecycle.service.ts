import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EContractRole,
  EContractStatus,
  EFromStatus,
  EPartyType,
  EToStatus,
} from '@contractflow/contracts-schema';
import {
  DataSource,
  IsNull,
  LessThanOrEqual,
  type EntityManager,
} from 'typeorm';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import { Company } from '../../identity/entities/company.entity';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { ContractPartyInvitation } from '../entities/contract-party-invitation.entity';
import type {
  ContractPartyInvitationPreviewResponse,
  ContractPartyInvitationResponse,
  CreateContractPartyInvitationRequestDto,
} from '../dto/contract-party-invitation.dto';
import type { CreateContractRequestDto } from '../dto/create-contract-request.dto';
import type { UpdateContractRequestDto } from '../dto/update-contract-request.dto';
import type { UpdateContractWorkspacesRequestDto } from '../dto/update-contract-workspaces-request.dto';
import type {
  ContractTransition,
  TransitionContractRequestDto,
} from '../dto/transition-contract-request.dto';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../entities/contract-role-invitation.entity';
import { ContractStatusHistory } from '../entities/contract-status-history.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import { MailService } from '../../mail/mail.service';
import {
  WORKSPACE_ROLES,
  type AssignableContractWorkspace,
} from './contract-workspace';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const transitionMap: Record<
  ContractTransition,
  { from: EContractStatus; to: EContractStatus }
> = {
  activate: { from: EContractStatus.DRAFT, to: EContractStatus.ACTIVE },
  hold: { from: EContractStatus.ACTIVE, to: EContractStatus.SUSPENDED },
  resume: { from: EContractStatus.SUSPENDED, to: EContractStatus.ACTIVE },
  complete: { from: EContractStatus.ACTIVE, to: EContractStatus.COMPLETED },
};

const historyFromStatus: Record<EContractStatus, EFromStatus> = {
  [EContractStatus.DRAFT]: EFromStatus.DRAFT,
  [EContractStatus.ACTIVE]: EFromStatus.ACTIVE,
  [EContractStatus.SUSPENDED]: EFromStatus.SUSPENDED,
  [EContractStatus.COMPLETED]: EFromStatus.COMPLETED,
};

const historyToStatus: Record<EContractStatus, EToStatus> = {
  [EContractStatus.DRAFT]: EToStatus.DRAFT,
  [EContractStatus.ACTIVE]: EToStatus.ACTIVE,
  [EContractStatus.SUSPENDED]: EToStatus.SUSPENDED,
  [EContractStatus.COMPLETED]: EToStatus.COMPLETED,
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ContractLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
  ) {}

  async managementPermissions(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<{
    canManage: boolean;
    canTransition: boolean;
    canRestore: boolean;
  }> {
    const manager = this.dataSource.manager;
    const membership = await manager.getRepository(CompanyUser).findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
    if (!membership) {
      throw new ForbiddenException('Active company membership is required.');
    }

    const party = await manager.getRepository(ContractParty).findOne({
      where: { contractId, companyId },
    });
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    const contract = await manager.getRepository(Contract).findOne({
      where: { id: contractId },
      select: { id: true, createdByCompanyId: true, deletedAt: true },
    });
    if (!contract) {
      throw new NotFoundException('Contract was not found.');
    }

    const isCreatorAdmin =
      membership.companyRole === ECompanyRole.COMPANY_ADMIN &&
      contract.createdByCompanyId === companyId;
    const authorizedRole =
      party.partyType === EPartyType.CLIENT
        ? EContractRole.CLIENT_PROJECT_MANAGER
        : [EPartyType.CONTRACTOR, EPartyType.SUBCONTRACTOR].includes(
              party.partyType,
            )
          ? EContractRole.CONTRACTOR_PROJECT_LEAD
          : null;
    const hasProjectLeadAssignment =
      !contract.deletedAt &&
      authorizedRole !== null &&
      Boolean(
        await manager
          .getRepository(ContractRoleAssignment)
          .createQueryBuilder('assignment')
          .where('assignment.companyId = :companyId', { companyId })
          .andWhere('assignment.contractPartyId = :partyId', {
            partyId: party.id,
          })
          .andWhere('assignment.companyUserId = :companyUserId', {
            companyUserId: membership.id,
          })
          .andWhere('assignment.role = :role', { role: authorizedRole })
          .andWhere('assignment.revokedAt IS NULL')
          .getOne(),
      );

    return {
      canManage: isCreatorAdmin && !contract.deletedAt,
      canTransition: hasProjectLeadAssignment,
      canRestore: isCreatorAdmin && Boolean(contract.deletedAt),
    };
  }

  async create(
    userId: string,
    companyId: string,
    dto: CreateContractRequestDto,
  ): Promise<Contract> {
    validateDateRange(dto.awardDate, dto.startDate, dto.endDate, dto.revisedEndDate, dto.actualCompletionDate);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const actor = await this.requireCompanyAdmin(
          manager,
          userId,
          companyId,
        );
        if (dto.parentContractId) {
          await this.requireCompanyParty(
            manager,
            dto.parentContractId,
            companyId,
          );
        }

        const contracts = manager.getRepository(Contract);
        const contract = contracts.create({
          referenceNumber: dto.referenceNumber.trim(),
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          contractType: dto.contractType,
          status: EContractStatus.DRAFT,
          parentContractId: dto.parentContractId ?? null,
          originalValueMinor: dto.originalValueMinor,
          currentValueMinor: dto.originalValueMinor,
          currencyCode: dto.currencyCode,
          retentionRateBps: dto.retentionRateBps,
          advancePaymentRateBps: dto.advancePaymentRateBps ?? null,
          paymentTermsDays: dto.paymentTermsDays,
          liquidatedDamagesPerDayMinor:
            dto.liquidatedDamagesPerDayMinor ?? null,
          awardDate: parseDate(dto.awardDate),
          startDate: parseDate(dto.startDate),
          endDate: parseDate(dto.endDate),
          revisedEndDate: dto.revisedEndDate
            ? parseDate(dto.revisedEndDate)
            : null,
          actualCompletionDate: dto.actualCompletionDate
            ? parseDate(dto.actualCompletionDate)
            : null,
          defectsLiabilityDays: dto.defectsLiabilityDays,
          timezone: dto.timezone,
          createdByCompanyId: companyId,
          deletedAt: null,
          deletedByCompanyUserId: null,
        });
        const savedContract = await contracts.save(contract);
        const parties = manager.getRepository(ContractParty);
        const party = parties.create({
          contractId: savedContract.id,
          companyId,
          partyType: dto.partyType,
          signatoryFirstName: null,
          signatoryLastName: null,
          signatoryTitle: null,
          signedAt: null,
        });
        await parties.save(party);

        const workspaces = manager.getRepository(ContractWorkspaceEntity);
        await workspaces.save(
          dto.workspaces.map((workspace) =>
            workspaces.create({
              contractId: savedContract.id,
              workspace,
              createdByCompanyUserId: actor.id,
            }),
          ),
        );

        const now = new Date();
        await manager.getRepository(ContractStatusHistory).save(
          manager.getRepository(ContractStatusHistory).create({
            contractId: savedContract.id,
            fromStatus: null,
            toStatus: EToStatus.DRAFT,
            reason: null,
            changedById: actor.id,
            changedAt: now,
          }),
        );
        return savedContract;
      });
    } catch (error) {
      if (isUniqueReferenceConflict(error)) {
        throw new ConflictException(
          'A contract with this reference number already exists.',
        );
      }
      throw error;
    }
  }

  async update(
    userId: string,
    companyId: string,
    contractId: string,
    dto: UpdateContractRequestDto,
  ): Promise<Contract> {
    return this.dataSource.transaction(async (manager) => {
      const { contract } = await this.requireOwnedContract(
        manager,
        userId,
        companyId,
        contractId,
      );
      const keys = Object.keys(dto);
      if (keys.length === 0) {
        throw new BadRequestException('At least one contract field is required.');
      }
      if (
        dto.originalValueMinor !== undefined &&
        contract.status !== EContractStatus.DRAFT &&
        dto.originalValueMinor !== Number(contract.originalValueMinor)
      ) {
        throw new ConflictException(
          'The original contract value cannot be changed after activation.',
        );
      }

      if (dto.title !== undefined) contract.title = dto.title.trim();
      if (dto.description !== undefined) {
        contract.description = dto.description?.trim() || null;
      }
      if (dto.contractType !== undefined) {
        contract.contractType = dto.contractType;
      }
      if (dto.parentContractId !== undefined) {
        if (dto.parentContractId) {
          await this.requireCompanyParty(
            manager,
            dto.parentContractId,
            companyId,
          );
          if (
            await this.parentWouldCreateCycle(
              manager,
              dto.parentContractId,
              contract.id,
            )
          ) {
            throw new BadRequestException(
              'A contract cannot be made a subcontract of its own descendant.',
            );
          }
        }
        contract.parentContractId = dto.parentContractId ?? null;
      }
      if (dto.originalValueMinor !== undefined) {
        contract.originalValueMinor = dto.originalValueMinor;
        if (contract.status === EContractStatus.DRAFT) {
          contract.currentValueMinor = dto.originalValueMinor;
        }
      }
      if (dto.currencyCode !== undefined) {
        contract.currencyCode = dto.currencyCode;
      }
      if (dto.retentionRateBps !== undefined) {
        contract.retentionRateBps = dto.retentionRateBps;
      }
      if (dto.advancePaymentRateBps !== undefined) {
        contract.advancePaymentRateBps = dto.advancePaymentRateBps;
      }
      if (dto.paymentTermsDays !== undefined) {
        contract.paymentTermsDays = dto.paymentTermsDays;
      }
      if (dto.liquidatedDamagesPerDayMinor !== undefined) {
        contract.liquidatedDamagesPerDayMinor =
          dto.liquidatedDamagesPerDayMinor;
      }
      if (dto.awardDate !== undefined) {
        contract.awardDate = parseDate(dto.awardDate);
      }
      if (dto.startDate !== undefined) {
        contract.startDate = parseDate(dto.startDate);
      }
      if (dto.endDate !== undefined) {
        contract.endDate = parseDate(dto.endDate);
      }
      if (dto.revisedEndDate !== undefined) {
        contract.revisedEndDate = dto.revisedEndDate
          ? parseDate(dto.revisedEndDate)
          : null;
      }
      if (dto.actualCompletionDate !== undefined) {
        contract.actualCompletionDate = dto.actualCompletionDate
          ? parseDate(dto.actualCompletionDate)
          : null;
      }
      if (dto.defectsLiabilityDays !== undefined) {
        contract.defectsLiabilityDays = dto.defectsLiabilityDays;
      }
      if (dto.timezone !== undefined) contract.timezone = dto.timezone;
      validateDateRange(
        contract.awardDate,
        contract.startDate,
        contract.endDate,
        contract.revisedEndDate,
        contract.actualCompletionDate,
      );
      return manager.getRepository(Contract).save(contract);
    });
  }

  async updateWorkspaces(
    userId: string,
    companyId: string,
    contractId: string,
    dto: UpdateContractWorkspacesRequestDto,
  ): Promise<AssignableContractWorkspace[]> {
    return this.dataSource.transaction(async (manager) => {
      const { contract, actor } = await this.requireOwnedContract(
        manager,
        userId,
        companyId,
        contractId,
      );
      const repository = manager.getRepository(ContractWorkspaceEntity);
      const current = await repository.find({ where: { contractId } });
      const currentWorkspaces = current.map(({ workspace }) => workspace);
      const removed = currentWorkspaces.filter(
        (workspace) => !dto.workspaces.includes(workspace),
      );
      const added = dto.workspaces.filter(
        (workspace) => !currentWorkspaces.includes(workspace),
      );
      const now = new Date();

      for (const workspace of removed) {
        const roles = WORKSPACE_ROLES[workspace];
        await manager
          .getRepository(ContractRoleAssignment)
          .createQueryBuilder()
          .update()
          .set({ revokedAt: now, revokedById: actor.id, updatedAt: now })
          .where(
            '"contract_party_id" IN (SELECT "id" FROM "contract_party" WHERE "contract_id" = :contractId)',
            { contractId },
          )
          .andWhere('"contract_role" IN (:...roles)', { roles })
          .andWhere('"revoked_at" IS NULL')
          .execute();
        await manager
          .getRepository(ContractRoleInvitation)
          .createQueryBuilder()
          .update()
          .set({ status: 'revoked', revokedAt: now, updatedAt: now })
          .where(
            '"contract_party_id" IN (SELECT "id" FROM "contract_party" WHERE "contract_id" = :contractId)',
            { contractId },
          )
          .andWhere('"workspace" = :workspace', { workspace })
          .andWhere('"status" = :pending', { pending: 'pending' })
          .execute();
        await repository.delete({ contractId, workspace });
      }

      if (added.length) {
        await repository.save(
          added.map((workspace) =>
            repository.create({
              contractId,
              workspace,
              createdByCompanyUserId: actor.id,
            }),
          ),
        );
      }

      if (removed.length) {
        await this.writeActivity(
          manager,
          contract,
          actor,
          'contract.workspaces_removed',
          `Removed ${removed.join(', ')} workspaces from ${contract.referenceNumber}.`,
          { removed },
          now,
        );
      }
      return dto.workspaces;
    });
  }

  async transition(
    userId: string,
    companyId: string,
    contractId: string,
    dto: TransitionContractRequestDto,
  ): Promise<Contract> {
    return this.dataSource.transaction(async (manager) => {
      const contract = await this.lockActiveContract(manager, contractId);
      const actor = await this.requireTransitionActor(
        manager,
        userId,
        companyId,
        contractId,
      );
      const transition = transitionMap[dto.transition];
      if (contract.status !== transition.from) {
        throw new ConflictException(
          `Cannot ${dto.transition} a contract in ${contract.status} status.`,
        );
      }
      const reason = dto.reason.trim();
      if (!reason) {
        throw new BadRequestException('A reason is required for this transition.');
      }

      contract.status = transition.to;
      const now = new Date();
      const saved = await manager.getRepository(Contract).save(contract);
      const historyRepository = manager.getRepository(ContractStatusHistory);
      await historyRepository.save(
        historyRepository.create({
          contractId,
          fromStatus: historyFromStatus[transition.from],
          toStatus: historyToStatus[transition.to],
          reason,
          changedById: actor.id,
          changedAt: now,
        }),
      );
      await this.writeActivity(
        manager,
        saved,
        actor,
        'contract.status_transitioned',
        `Changed ${saved.referenceNumber} from ${transition.from} to ${transition.to}.`,
        {
          fromStatus: transition.from,
          toStatus: transition.to,
          reason,
        },
        now,
      );
      return saved;
    });
  }

  async archive(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const { contract, actor } = await this.requireOwnedContract(
        manager,
        userId,
        companyId,
        contractId,
      );
      const now = new Date();
      contract.deletedAt = now;
      contract.deletedByCompanyUserId = actor.id;
      await manager.getRepository(Contract).save(contract);
      await this.revokeContractAccess(manager, contractId, actor.id, now);
      await manager.getRepository(ContractPartyInvitation).update(
        {
          sourceContractPartyId: await this.sourcePartyId(
            manager,
            contractId,
            companyId,
          ),
          status: 'pending',
        },
        { status: 'revoked', revokedAt: now },
      );
      await this.writeActivity(
        manager,
        contract,
        actor,
        'contract.deleted',
        `Archived contract ${contract.referenceNumber}.`,
        { deletedAt: now.toISOString() },
        now,
      );
    });
  }

  async restore(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<Contract> {
    return this.dataSource.transaction(async (manager) => {
      const { contract, actor } = await this.requireOwnedContract(
        manager,
        userId,
        companyId,
        contractId,
        true,
      );
      if (!contract.deletedAt) {
        throw new ConflictException('This contract is not archived.');
      }
      const now = new Date();
      contract.deletedAt = null;
      contract.deletedByCompanyUserId = null;
      const restored = await manager.getRepository(Contract).save(contract);
      await this.writeActivity(
        manager,
        contract,
        actor,
        'contract.restored',
        `Restored contract ${contract.referenceNumber}.`,
        { restoredAt: now.toISOString() },
        now,
      );
      return restored;
    });
  }

  async listPartyInvitations(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractPartyInvitationResponse[]> {
    const { party } = await this.requireOwnedContractOutsideTransaction(
      userId,
      companyId,
      contractId,
    );
    const invitations = this.dataSource.getRepository(ContractPartyInvitation);
    await invitations.update(
      {
        sourceContractPartyId: party.id,
        status: 'pending',
        expiresAt: LessThanOrEqual(new Date()),
      },
      { status: 'expired' },
    );
    const rows = await invitations.find({
      where: { sourceContractPartyId: party.id },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return rows.map(toInvitationResponse);
  }

  async inviteCompany(
    userId: string,
    companyId: string,
    contractId: string,
    dto: CreateContractPartyInvitationRequestDto,
  ): Promise<ContractPartyInvitationResponse> {
    return this.dataSource.transaction(async (manager) => {
      const { contract, actor, party } = await this.requireOwnedContract(
        manager,
        userId,
        companyId,
        contractId,
      );
      const targets = await manager
        .getRepository(Company)
        .createQueryBuilder('company')
        .where('LOWER(company.email) = :email', { email: dto.email })
        .andWhere('company.status = :status', {
          status: ECompanyStatus.ACTIVE,
        })
        .andWhere('company.verifiedAt IS NOT NULL')
        .getMany();
      if (targets.length !== 1) {
        throw new NotFoundException(
          'No single active, verified company was found for this email.',
        );
      }
      const target = targets[0];
      if (target.id === companyId) {
        throw new BadRequestException(
          'A company cannot invite itself to its contract.',
        );
      }
      const targetParty = await manager.getRepository(ContractParty).findOne({
        where: { contractId, companyId: target.id },
      });
      if (targetParty) {
        throw new ConflictException(
          'This company is already a party to the contract.',
        );
      }

      const invitations = manager.getRepository(ContractPartyInvitation);
      const now = new Date();
      await invitations.update(
        {
          sourceContractPartyId: party.id,
          targetCompanyId: target.id,
          partyType: dto.partyType,
          status: 'pending',
          expiresAt: LessThanOrEqual(now),
        },
        { status: 'expired' },
      );
      const duplicate = await invitations.findOne({
        where: {
          sourceContractPartyId: party.id,
          targetCompanyId: target.id,
          partyType: dto.partyType,
          status: 'pending',
        },
      });
      if (duplicate) {
        throw new ConflictException(
          'A pending invitation already exists for this company and party type.',
        );
      }

      const token = randomBytes(32).toString('base64url');
      const invitation = invitations.create({
        sourceContractPartyId: party.id,
        sourceCompanyId: companyId,
        targetCompanyId: target.id,
        invitedByCompanyUserId: actor.id,
        acceptedByCompanyUserId: null,
        partyType: dto.partyType,
        email: target.email,
        tokenHash: hashToken(token),
        status: 'pending',
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        respondedAt: null,
        revokedAt: null,
      });
      const saved = await invitations.save(invitation);
      await this.mail.sendContractPartyInvitationEmail(
        target.email,
        contract.title,
        target.name,
        dto.partyType,
        token,
      );
      await this.writeActivity(
        manager,
        contract,
        actor,
        'contract.party_invitation_created',
        `Invited ${target.name} to join ${contract.referenceNumber}.`,
        { invitationId: saved.id, targetCompanyId: target.id },
        now,
      );
      return toInvitationResponse(saved);
    });
  }

  async revokeCompanyInvitation(
    userId: string,
    companyId: string,
    contractId: string,
    invitationId: string,
  ): Promise<ContractPartyInvitationResponse> {
    return this.dataSource.transaction(async (manager) => {
      const { contract, actor, party } = await this.requireOwnedContract(
        manager,
        userId,
        companyId,
        contractId,
      );
      const invitations = manager.getRepository(ContractPartyInvitation);
      const invitation = await invitations.findOne({
        where: { id: invitationId, sourceContractPartyId: party.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invitation) {
        throw new NotFoundException('Contract invitation was not found.');
      }
      if (invitation.status !== 'pending' || invitation.expiresAt <= new Date()) {
        throw new ConflictException(
          'Only a pending, unexpired contract invitation can be revoked.',
        );
      }
      const now = new Date();
      invitation.status = 'revoked';
      invitation.revokedAt = now;
      const saved = await invitations.save(invitation);
      await this.writeActivity(
        manager,
        contract,
        actor,
        'contract.party_invitation_revoked',
        `Revoked a contract invitation for ${invitation.email}.`,
        { invitationId },
        now,
      );
      return toInvitationResponse(saved);
    });
  }

  async getCompanyInvitationPreview(
    token: string,
  ): Promise<ContractPartyInvitationPreviewResponse> {
    const invitation = await this.dataSource
      .getRepository(ContractPartyInvitation)
      .findOne({ where: { tokenHash: hashToken(token) } });
    if (!invitation) {
      throw new NotFoundException('Contract invitation was not found.');
    }
    if (invitation.status !== 'pending' || invitation.revokedAt) {
      throw new ConflictException('This contract invitation is no longer active.');
    }
    if (invitation.expiresAt <= new Date()) {
      await this.dataSource
        .getRepository(ContractPartyInvitation)
        .update(invitation.id, { status: 'expired' });
      throw new ConflictException('This contract invitation has expired.');
    }
    const source = await this.dataSource.getRepository(ContractParty).findOne({
      where: { id: invitation.sourceContractPartyId },
      relations: { contract: true, company: true },
    });
    const contract = source?.contract;
    if (!source || !contract || contract.deletedAt) {
      throw new NotFoundException('Contract invitation was not found.');
    }
    return {
      companyId: invitation.targetCompanyId,
      contractTitle: contract.title,
      invitingCompanyName: source.company.name,
      email: invitation.email,
      partyType: invitation.partyType,
      expiresAt: invitation.expiresAt,
    };
  }

  async respondToCompanyInvitation(
    userId: string,
    companyId: string,
    token: string,
    decision: 'accept' | 'reject',
  ): Promise<{ status: 'accepted' | 'rejected' | 'expired' }> {
    const tokenHash = hashToken(token);
    const preflight = await this.dataSource
      .getRepository(ContractPartyInvitation)
      .findOne({ where: { tokenHash } });
    if (!preflight) {
      throw new NotFoundException('Contract invitation was not found.');
    }
    const source = await this.dataSource
      .getRepository(ContractParty)
      .findOne({ where: { id: preflight.sourceContractPartyId } });
    if (!source) {
      throw new NotFoundException('Contract invitation was not found.');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const contract = await this.lockActiveContract(
        manager,
        source.contractId,
      );
      const invitation = await manager
        .getRepository(ContractPartyInvitation)
        .createQueryBuilder('invitation')
        .where('invitation.tokenHash = :tokenHash', { tokenHash })
        .setLock('pessimistic_write')
        .getOne();
      if (!invitation) {
        throw new NotFoundException('Contract invitation was not found.');
      }
      if (invitation.targetCompanyId !== companyId) {
        throw new ForbiddenException(
          'This invitation was sent to a different company.',
        );
      }
      if (invitation.status !== 'pending' || invitation.revokedAt) {
        throw new ConflictException(
          'This contract invitation has already been used.',
        );
      }
      const now = new Date();
      if (invitation.expiresAt <= now) {
        invitation.status = 'expired';
        await manager.getRepository(ContractPartyInvitation).save(invitation);
        return { status: 'expired' as const };
      }

      const actor = await this.requireCompanyAdmin(
        manager,
        userId,
        companyId,
      );
      const targetCompany = await manager.getRepository(Company).findOne({
        where: { id: companyId, status: ECompanyStatus.ACTIVE },
        lock: { mode: 'pessimistic_read' },
      });
      if (
        !targetCompany?.verifiedAt ||
        targetCompany.email.toLowerCase() !== invitation.email.toLowerCase()
      ) {
        throw new ForbiddenException(
          'The invited company must remain verified and match the invitation email.',
        );
      }

      if (decision === 'accept') {
        const duplicateParty = await manager
          .getRepository(ContractParty)
          .findOne({
            where: { contractId: contract.id, companyId },
          });
        if (duplicateParty) {
          throw new ConflictException(
            'This company is already a party to the contract.',
          );
        }
        const parties = manager.getRepository(ContractParty);
        await parties.save(
          parties.create({
            contractId: contract.id,
            companyId,
            partyType: invitation.partyType,
            signatoryFirstName: null,
            signatoryLastName: null,
            signatoryTitle: null,
            signedAt: null,
          }),
        );
        invitation.status = 'accepted';
        invitation.acceptedByCompanyUserId = actor.id;
      } else {
        invitation.status = 'rejected';
      }
      invitation.respondedAt = now;
      await manager.getRepository(ContractPartyInvitation).save(invitation);
      await this.writeActivity(
        manager,
        contract,
        actor,
        decision === 'accept'
          ? 'contract.party_invitation_accepted'
          : 'contract.party_invitation_rejected',
        `${targetCompany.name} ${decision}ed the contract invitation.`,
        { invitationId: invitation.id, decision },
        now,
      );
      return { status: invitation.status as 'accepted' | 'rejected' };
    });
    if (result.status === 'expired') {
      throw new ConflictException('This contract invitation has expired.');
    }
    return result;
  }

  private async requireCompanyAdmin(
    manager: EntityManager,
    userId: string,
    companyId: string,
  ): Promise<CompanyUser> {
    const company = await manager.getRepository(Company).findOne({
      where: { id: companyId, status: ECompanyStatus.ACTIVE },
      lock: { mode: 'pessimistic_read' },
    });
    if (!company) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const actor = await manager.getRepository(CompanyUser).findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!actor || actor.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only a Company Administrator can manage this contract.',
      );
    }
    return actor;
  }

  private async requireOwnedContract(
    manager: EntityManager,
    userId: string,
    companyId: string,
    contractId: string,
    allowArchived = false,
  ): Promise<{ contract: Contract; actor: CompanyUser; party: ContractParty }> {
    const contract = await manager.getRepository(Contract).findOne({
      where: { id: contractId },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !contract ||
      contract.createdByCompanyId !== companyId ||
      (!allowArchived && contract.deletedAt)
    ) {
      throw new NotFoundException('Contract was not found.');
    }
    const actor = await this.requireCompanyAdmin(
      manager,
      userId,
      companyId,
    );
    const party = await manager.getRepository(ContractParty).findOne({
      where: { contractId, companyId },
      lock: { mode: 'pessimistic_read' },
    });
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    return { contract, actor, party };
  }

  private async requireOwnedContractOutsideTransaction(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<{ contract: Contract; actor: CompanyUser; party: ContractParty }> {
    return this.dataSource.transaction((manager) =>
      this.requireOwnedContract(manager, userId, companyId, contractId),
    );
  }

  private async requireCompanyParty(
    manager: EntityManager,
    contractId: string,
    companyId: string,
  ): Promise<void> {
    const parent = await manager.getRepository(Contract).findOne({
      where: { id: contractId, deletedAt: IsNull() },
    });
    if (!parent) {
      throw new NotFoundException('Parent contract was not found.');
    }
    const party = await manager.getRepository(ContractParty).findOne({
      where: { contractId, companyId },
    });
    if (!party) {
      throw new NotFoundException(
        'Parent contract was not found for this company.',
      );
    }
  }

  private async parentWouldCreateCycle(
    manager: EntityManager,
    parentContractId: string,
    contractId: string,
  ): Promise<boolean> {
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
  }

  private async lockActiveContract(
    manager: EntityManager,
    contractId: string,
  ): Promise<Contract> {
    const contract = await manager.getRepository(Contract).findOne({
      where: { id: contractId, deletedAt: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!contract) {
      throw new NotFoundException('Contract was not found.');
    }
    return contract;
  }

  private async requireTransitionActor(
    manager: EntityManager,
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<CompanyUser> {
    const actor = await manager.getRepository(CompanyUser).findOne({
      where: {
        userId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!actor) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const party = await manager.getRepository(ContractParty).findOne({
      where: { contractId, companyId },
      lock: { mode: 'pessimistic_read' },
    });
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    const authorizedRole =
      party.partyType === EPartyType.CLIENT
        ? EContractRole.CLIENT_PROJECT_MANAGER
        : [EPartyType.CONTRACTOR, EPartyType.SUBCONTRACTOR].includes(
              party.partyType,
            )
          ? EContractRole.CONTRACTOR_PROJECT_LEAD
          : null;
    if (!authorizedRole) {
      throw new ForbiddenException(
        'This contract party cannot initiate lifecycle transitions.',
      );
    }
    const assignment = await manager
      .getRepository(ContractRoleAssignment)
      .createQueryBuilder('assignment')
      .where('assignment.companyId = :companyId', { companyId })
      .andWhere('assignment.contractPartyId = :partyId', {
        partyId: party.id,
      })
      .andWhere('assignment.companyUserId = :companyUserId', {
        companyUserId: actor.id,
      })
      .andWhere('assignment.role = :role', { role: authorizedRole })
      .andWhere('assignment.revokedAt IS NULL')
      .setLock('pessimistic_read')
      .getOne();
    if (!assignment) {
      throw new ForbiddenException(
        'An active project lead assignment is required to change contract status.',
      );
    }
    return actor;
  }

  private async revokeContractAccess(
    manager: EntityManager,
    contractId: string,
    actorCompanyUserId: string,
    now: Date,
  ): Promise<void> {
    await manager
      .getRepository(ContractRoleAssignment)
      .createQueryBuilder()
      .update()
      .set({
        revokedAt: now,
        revokedById: actorCompanyUserId,
        updatedAt: now,
      })
      .where(
        '"contract_party_id" IN (SELECT "id" FROM "contract_party" WHERE "contract_id" = :contractId)',
        { contractId },
      )
      .andWhere('"revoked_at" IS NULL')
      .execute();
    await manager
      .getRepository(ContractRoleInvitation)
      .createQueryBuilder()
      .update()
      .set({ status: 'revoked', revokedAt: now, updatedAt: now })
      .where(
        '"contract_party_id" IN (SELECT "id" FROM "contract_party" WHERE "contract_id" = :contractId)',
        { contractId },
      )
      .andWhere('"status" = :pending', { pending: 'pending' })
      .execute();
  }

  private async sourcePartyId(
    manager: EntityManager,
    contractId: string,
    companyId: string,
  ): Promise<string> {
    const party = await manager.getRepository(ContractParty).findOne({
      where: { contractId, companyId },
      select: { id: true },
    });
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    return party.id;
  }

  private async writeActivity(
    manager: EntityManager,
    contract: Contract,
    actor: CompanyUser,
    action: string,
    summary: string,
    changes: Record<string, unknown>,
    occurredAt: Date,
  ): Promise<void> {
    const repository = manager.getRepository(ActivityLog);
    await repository.save(
      repository.create({
        contractId: contract.id,
        companyId: actor.companyId,
        actorUserId: actor.id,
        action,
        entityType: 'contract',
        entityId: randomUUID(),
        summary,
        changes: { before: null, after: changes },
        metadata: {},
        ipAddress: null,
        userAgent: null,
        requestId: null,
        occurredAt,
      }),
    );
  }
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function datePart(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function validateDateRange(
  awardDate: Date | string,
  startDate: Date | string,
  endDate: Date | string,
  revisedEndDate?: Date | string | null,
  actualCompletionDate?: Date | string | null,
): void {
  const award = datePart(awardDate);
  const start = datePart(startDate);
  const end = datePart(endDate);
  const revised = datePart(revisedEndDate);
  const actual = datePart(actualCompletionDate);
  if (!award || !start || !end || start > end) {
    throw new BadRequestException(
      'The contract start date must not be after its end date.',
    );
  }
  if (revised && revised < end) {
    throw new BadRequestException(
      'The revised end date must not be before the planned end date.',
    );
  }
  if (actual && actual < start) {
    throw new BadRequestException(
      'The actual completion date must not be before the start date.',
    );
  }
}

function toInvitationResponse(
  invitation: ContractPartyInvitation,
): ContractPartyInvitationResponse {
  return {
    id: invitation.id,
    email: invitation.email,
    partyType: invitation.partyType,
    status: invitation.status,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    respondedAt: invitation.respondedAt,
    revokedAt: invitation.revokedAt,
  };
}

function isUniqueReferenceConflict(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('driverError' in error)
  ) {
    return false;
  }
  const driverError = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23505' &&
    'constraint' in driverError &&
    driverError.constraint === 'UQ_4eb2644094e921caea38a4fe908'
  );
}
