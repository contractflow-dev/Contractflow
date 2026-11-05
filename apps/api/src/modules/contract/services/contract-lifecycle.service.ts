import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  ECompanyRole,
  EContractRole,
  EContractStatus,
  EFromStatus,
  EPartyType,
  EToStatus,
} from '@contractflow/contracts-schema';
import type { ContractSite as ContractSiteResponse } from '@contractflow/contracts-schema';
import type {
  ContractPartyInvitationPreviewResponse,
  ContractPartyInvitationResponse,
  CreateContractPartyInvitationRequestDto,
} from '../dto/contract-party-invitation.dto';
import type { CreateContractRequestDto } from '../dto/create-contract-request.dto';
import type { RecordContractSignatoryRequestDto } from '../dto/record-contract-signatory-request.dto';
import type {
  CreateContractSiteRequestDto,
  UpdateContractSiteRequestDto,
} from '../dto/contract-site-request.dto';
import type { ContractSite } from '../../site-operations/entities/contract-site.entity';
import type { UpdateContractRequestDto } from '../dto/update-contract-request.dto';
import type { UpdateContractWorkspacesRequestDto } from '../dto/update-contract-workspaces-request.dto';
import type {
  ContractTransition,
  TransitionContractRequestDto,
} from '../dto/transition-contract-request.dto';
import type { Contract } from '../entities/contract.entity';
import type { ContractParty } from '../entities/contract-party.entity';
import type { ContractPartyInvitation } from '../entities/contract-party-invitation.entity';
import type { CompanyUser } from '../../identity/entities/company-user.entity';
import {
  CONTRACT_LIFECYCLE_UNIT_OF_WORK,
  type IContractLifecycleContext,
  type IContractLifecycleUnitOfWork,
} from '../interfaces/contract-lifecycle-persistence.interface';
import { MailService } from '../../mail/mail.service';
import {
  WORKSPACE_ROLES,
  type AssignableContractWorkspace,
} from './contract-workspace';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RecordedContractSignatory = Pick<
  ContractParty,
  | 'id'
  | 'companyId'
  | 'partyType'
  | 'signatoryFirstName'
  | 'signatoryLastName'
  | 'signatoryTitle'
  | 'signedAt'
>;

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

function projectLeadRole(partyType: EPartyType): EContractRole | null {
  if (partyType === EPartyType.CLIENT) {
    return EContractRole.CLIENT_PROJECT_MANAGER;
  }
  return [EPartyType.CONTRACTOR, EPartyType.SUBCONTRACTOR].includes(partyType)
    ? EContractRole.CONTRACTOR_PROJECT_LEAD
    : null;
}

@Injectable()
export class ContractLifecycleService {
  constructor(
    @Inject(CONTRACT_LIFECYCLE_UNIT_OF_WORK)
    private readonly unitOfWork: IContractLifecycleUnitOfWork,
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
    return this.unitOfWork.execute(async (context) => {
      const membership = await context.memberships.findActive(
        userId,
        companyId,
      );
      if (!membership) {
        throw new ForbiddenException('Active company membership is required.');
      }

      const party = await context.parties.find(contractId, companyId);
      if (!party) {
        throw new NotFoundException('Contract was not found.');
      }
      const contract =
        await context.contracts.findPermissionSnapshot(contractId);
      if (!contract) {
        throw new NotFoundException('Contract was not found.');
      }

      const isCreatorAdmin =
        membership.companyRole === ECompanyRole.COMPANY_ADMIN &&
        contract.createdByCompanyId === companyId;
      const authorizedRole = projectLeadRole(party.partyType);
      const hasProjectLeadAssignment =
        !contract.deletedAt &&
        authorizedRole !== null &&
        (await context.roleAssignments.hasActiveAssignment({
          companyId,
          contractPartyId: party.id,
          companyUserId: membership.id,
          role: authorizedRole,
        }));

      return {
        canManage: isCreatorAdmin && !contract.deletedAt,
        canTransition: hasProjectLeadAssignment,
        canRestore: isCreatorAdmin && Boolean(contract.deletedAt),
      };
    });
  }

  async create(
    userId: string,
    companyId: string,
    dto: CreateContractRequestDto,
  ): Promise<Contract> {
    validateDateRange(
      dto.awardDate,
      dto.startDate,
      dto.endDate,
      dto.revisedEndDate,
      dto.actualCompletionDate,
    );
    try {
      return await this.unitOfWork.execute(async (context) => {
        const actor = await this.requireCompanyAdmin(
          context,
          userId,
          companyId,
        );
        if (dto.parentContractId) {
          await this.requireCompanyParty(
            context,
            dto.parentContractId,
            companyId,
          );
        }

        const savedContract = await context.contracts.create({
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
        await context.parties.create({
          contractId: savedContract.id,
          companyId,
          partyType: dto.partyType,
        });
        await context.workspaces.addMany(
          savedContract.id,
          dto.workspaces,
          actor.id,
        );
        await context.statusHistory.record({
          contractId: savedContract.id,
          fromStatus: null,
          toStatus: EToStatus.DRAFT,
          reason: null,
          changedById: actor.id,
          changedAt: new Date(),
        });
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
    return this.unitOfWork.execute(async (context) => {
      const { contract } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      const keys = Object.keys(dto);
      if (keys.length === 0) {
        throw new BadRequestException(
          'At least one contract field is required.',
        );
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
            context,
            dto.parentContractId,
            companyId,
          );
          if (
            await context.contracts.parentWouldCreateCycle(
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
      return context.contracts.save(contract);
    });
  }

  async updateWorkspaces(
    userId: string,
    companyId: string,
    contractId: string,
    dto: UpdateContractWorkspacesRequestDto,
  ): Promise<AssignableContractWorkspace[]> {
    return this.unitOfWork.execute(async (context) => {
      const { contract, actor } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      const currentWorkspaces =
        await context.workspaces.listWorkspaces(contractId);
      const removed = currentWorkspaces.filter(
        (workspace) => !dto.workspaces.includes(workspace),
      );
      const added = dto.workspaces.filter(
        (workspace) => !currentWorkspaces.includes(workspace),
      );
      const now = new Date();

      for (const workspace of removed) {
        await context.roleAssignments.revokeForWorkspaceRoles(
          contractId,
          WORKSPACE_ROLES[workspace],
          actor.id,
          now,
        );
        await context.roleInvitations.revokePendingForWorkspace(
          contractId,
          workspace,
          now,
        );
        await context.workspaces.remove(contractId, workspace);
      }

      if (added.length) {
        await context.workspaces.addMany(contractId, added, actor.id);
      }

      if (removed.length) {
        await this.writeActivity(
          context,
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
    return this.unitOfWork.execute(async (context) => {
      const contract = await this.lockActiveContract(context, contractId);
      const actor = await this.requireTransitionActor(
        context,
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
        throw new BadRequestException(
          'A reason is required for this transition.',
        );
      }

      contract.status = transition.to;
      const now = new Date();
      const saved = await context.contracts.save(contract);
      await context.statusHistory.record({
        contractId,
        fromStatus: historyFromStatus[transition.from],
        toStatus: historyToStatus[transition.to],
        reason,
        changedById: actor.id,
        changedAt: now,
      });
      await this.writeActivity(
        context,
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
    await this.unitOfWork.execute(async (context) => {
      const { contract, actor, party } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      const now = new Date();
      contract.deletedAt = now;
      contract.deletedByCompanyUserId = actor.id;
      await context.contracts.save(contract);
      await context.roleAssignments.revokeAllForContract(
        contractId,
        actor.id,
        now,
      );
      await context.roleInvitations.revokeAllPendingForContract(
        contractId,
        now,
      );
      await context.partyInvitations.revokePendingBySource(party.id, now);
      await this.writeActivity(
        context,
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
    return this.unitOfWork.execute(async (context) => {
      const { contract, actor } = await this.requireOwnedContract(
        context,
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
      const restored = await context.contracts.save(contract);
      await this.writeActivity(
        context,
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

  /**
   * Contract sites are contract setup data: the creating company's Company
   * Administrator manages them, separately from project-workspace reads.
   */
  async listSites(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractSiteResponse[]> {
    return this.unitOfWork.execute(async (context) => {
      await this.requireOwnedContract(context, userId, companyId, contractId);
      const sites = await context.sites.listByContract(contractId);
      return sites.map(toSiteResponse);
    });
  }

  async createSite(
    userId: string,
    companyId: string,
    contractId: string,
    dto: CreateContractSiteRequestDto,
  ): Promise<ContractSiteResponse> {
    return this.unitOfWork.execute(async (context) => {
      const { contract, actor } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      await this.requireUniqueSiteCode(context, contractId, dto.siteCode);
      const site = await context.sites.create({
        contractId,
        name: dto.name.trim(),
        siteCode: dto.siteCode.trim(),
        addressLine1: dto.addressLine1.trim(),
        city: dto.city.trim(),
        stateRegion: dto.stateRegion.trim(),
        countryCode: dto.countryCode,
        latitudeE6: dto.latitudeE6,
        longitudeE6: dto.longitudeE6,
        status: dto.status,
      });
      await this.writeActivity(
        context,
        contract,
        actor,
        'contract.site_created',
        `Added site ${site.siteCode} to ${contract.referenceNumber}.`,
        { siteId: site.id, siteCode: site.siteCode },
        new Date(),
      );
      return toSiteResponse(site);
    });
  }

  async updateSite(
    userId: string,
    companyId: string,
    contractId: string,
    siteId: string,
    dto: UpdateContractSiteRequestDto,
  ): Promise<ContractSiteResponse> {
    const fields = Object.keys(dto) as Array<keyof UpdateContractSiteRequestDto>;
    if (fields.length === 0) {
      throw new BadRequestException('At least one site field is required.');
    }
    return this.unitOfWork.execute(async (context) => {
      const { contract, actor } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      const site = await context.sites.findForUpdate(contractId, siteId);
      if (!site) {
        throw new NotFoundException('Site was not found.');
      }
      if (dto.siteCode !== undefined && dto.siteCode !== site.siteCode) {
        await this.requireUniqueSiteCode(context, contractId, dto.siteCode);
      }

      if (dto.name !== undefined) site.name = dto.name.trim();
      if (dto.siteCode !== undefined) site.siteCode = dto.siteCode.trim();
      if (dto.addressLine1 !== undefined) {
        site.addressLine1 = dto.addressLine1.trim();
      }
      if (dto.city !== undefined) site.city = dto.city.trim();
      if (dto.stateRegion !== undefined) {
        site.stateRegion = dto.stateRegion.trim();
      }
      if (dto.countryCode !== undefined) site.countryCode = dto.countryCode;
      if (dto.latitudeE6 !== undefined) site.latitudeE6 = dto.latitudeE6;
      if (dto.longitudeE6 !== undefined) site.longitudeE6 = dto.longitudeE6;
      if (dto.status !== undefined) site.status = dto.status;

      const saved = await context.sites.save(site);
      await this.writeActivity(
        context,
        contract,
        actor,
        'contract.site_updated',
        `Updated site ${saved.siteCode} on ${contract.referenceNumber}.`,
        { siteId: saved.id, fields },
        new Date(),
      );
      return toSiteResponse(saved);
    });
  }

  async getSignatory(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<RecordedContractSignatory> {
    return this.unitOfWork.execute(async (context) => {
      await this.lockActiveContract(context, contractId);
      await this.requireCompanyAdmin(context, userId, companyId);
      const party = await context.parties.find(contractId, companyId);
      if (!party) {
        throw new NotFoundException('Contract was not found.');
      }
      return toSignatoryResponse(party);
    });
  }

  /**
   * Records the acting company's own signatory on its CONTRACT_PARTY row.
   * Any party's Company Administrator may do this; it never touches another
   * party's signature.
   */
  async recordSignatory(
    userId: string,
    companyId: string,
    contractId: string,
    dto: RecordContractSignatoryRequestDto,
  ): Promise<RecordedContractSignatory> {
    const signedAt = new Date(dto.signedAt);
    if (Number.isNaN(signedAt.getTime()) || signedAt > new Date()) {
      throw new BadRequestException(
        'The signing date must be a valid date that is not in the future.',
      );
    }
    return this.unitOfWork.execute(async (context) => {
      const contract = await this.lockActiveContract(context, contractId);
      const actor = await this.requireCompanyAdmin(context, userId, companyId);
      const party = await context.parties.findForUpdate(contractId, companyId);
      if (!party) {
        throw new NotFoundException('Contract was not found.');
      }

      party.signatoryFirstName = dto.signatoryFirstName.trim();
      party.signatoryLastName = dto.signatoryLastName.trim();
      party.signatoryTitle = dto.signatoryTitle.trim();
      party.signedAt = signedAt;
      const saved = await context.parties.save(party);
      await this.writeActivity(
        context,
        contract,
        actor,
        'contract.signatory_recorded',
        `Recorded the signatory for ${contract.referenceNumber}.`,
        { contractPartyId: saved.id, signedAt: signedAt.toISOString() },
        new Date(),
      );
      return toSignatoryResponse(saved);
    });
  }

  async listPartyInvitations(
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<ContractPartyInvitationResponse[]> {
    return this.unitOfWork.execute(async (context) => {
      const { party } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      await context.partyInvitations.expirePendingBySource(
        party.id,
        new Date(),
      );
      const rows = await context.partyInvitations.listBySource(party.id);
      return rows.map(toInvitationResponse);
    });
  }

  async inviteCompany(
    userId: string,
    companyId: string,
    contractId: string,
    dto: CreateContractPartyInvitationRequestDto,
  ): Promise<ContractPartyInvitationResponse> {
    return this.unitOfWork.execute(async (context) => {
      const { contract, actor, party } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      const targets = await context.companies.findActiveVerifiedByEmail(
        dto.email,
      );
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
      const targetParty = await context.parties.find(contractId, target.id);
      if (targetParty) {
        throw new ConflictException(
          'This company is already a party to the contract.',
        );
      }

      const now = new Date();
      const duplicateCriteria = {
        sourcePartyId: party.id,
        targetCompanyId: target.id,
        partyType: dto.partyType,
      };
      await context.partyInvitations.expireDuplicatePending(
        duplicateCriteria,
        now,
      );
      const duplicate =
        await context.partyInvitations.findPendingDuplicate(duplicateCriteria);
      if (duplicate) {
        throw new ConflictException(
          'A pending invitation already exists for this company and party type.',
        );
      }

      const token = randomBytes(32).toString('base64url');
      const saved = await context.partyInvitations.create({
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
      // Known risk: the email is sent before the transaction commits, so a
      // later failure rolls back the invitation after the recipient was mailed.
      await this.mail.sendContractPartyInvitationEmail(
        target.email,
        contract.title,
        target.name,
        dto.partyType,
        token,
      );
      await this.writeActivity(
        context,
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
    return this.unitOfWork.execute(async (context) => {
      const { contract, actor, party } = await this.requireOwnedContract(
        context,
        userId,
        companyId,
        contractId,
      );
      const invitation =
        await context.partyInvitations.findBySourceAndIdForUpdate(
          invitationId,
          party.id,
        );
      if (!invitation) {
        throw new NotFoundException('Contract invitation was not found.');
      }
      if (
        invitation.status !== 'pending' ||
        invitation.expiresAt <= new Date()
      ) {
        throw new ConflictException(
          'Only a pending, unexpired contract invitation can be revoked.',
        );
      }
      const now = new Date();
      invitation.status = 'revoked';
      invitation.revokedAt = now;
      const saved = await context.partyInvitations.save(invitation);
      await this.writeActivity(
        context,
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
    // Expiry is persisted inside the unit of work; the conflict is thrown
    // afterwards so the update is committed rather than rolled back.
    const outcome = await this.unitOfWork.execute(async (context) => {
      const invitation = await context.partyInvitations.findByTokenHash(
        hashToken(token),
      );
      if (!invitation) {
        throw new NotFoundException('Contract invitation was not found.');
      }
      if (invitation.status !== 'pending' || invitation.revokedAt) {
        throw new ConflictException(
          'This contract invitation is no longer active.',
        );
      }
      if (invitation.expiresAt <= new Date()) {
        await context.partyInvitations.expireIfPending(invitation.id);
        return { expired: true as const };
      }
      const source = await context.parties.findByIdWithContractAndCompany(
        invitation.sourceContractPartyId,
      );
      const contract = source?.contract;
      if (!source || !contract || contract.deletedAt) {
        throw new NotFoundException('Contract invitation was not found.');
      }
      return {
        expired: false as const,
        preview: {
          companyId: invitation.targetCompanyId,
          contractTitle: contract.title,
          invitingCompanyName: source.company.name,
          email: invitation.email,
          partyType: invitation.partyType,
          expiresAt: invitation.expiresAt,
        },
      };
    });
    if (outcome.expired) {
      throw new ConflictException('This contract invitation has expired.');
    }
    return outcome.preview;
  }

  async respondToCompanyInvitation(
    userId: string,
    companyId: string,
    token: string,
    decision: 'accept' | 'reject',
  ): Promise<{ status: 'accepted' | 'rejected' | 'expired' }> {
    const tokenHash = hashToken(token);
    const sourceContractId = await this.unitOfWork.execute(async (context) => {
      const preflight =
        await context.partyInvitations.findByTokenHash(tokenHash);
      if (!preflight) {
        throw new NotFoundException('Contract invitation was not found.');
      }
      const source = await context.parties.findById(
        preflight.sourceContractPartyId,
      );
      if (!source) {
        throw new NotFoundException('Contract invitation was not found.');
      }
      return source.contractId;
    });

    const result = await this.unitOfWork.execute(async (context) => {
      const contract = await this.lockActiveContract(context, sourceContractId);
      const invitation =
        await context.partyInvitations.findByTokenHashForUpdate(tokenHash);
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
        await context.partyInvitations.save(invitation);
        return { status: 'expired' as const };
      }

      const actor = await this.requireCompanyAdmin(context, userId, companyId);
      const targetCompany =
        await context.companies.findActiveForShare(companyId);
      if (
        !targetCompany?.verifiedAt ||
        targetCompany.email.toLowerCase() !== invitation.email.toLowerCase()
      ) {
        throw new ForbiddenException(
          'The invited company must remain verified and match the invitation email.',
        );
      }

      if (decision === 'accept') {
        const duplicateParty = await context.parties.find(
          contract.id,
          companyId,
        );
        if (duplicateParty) {
          throw new ConflictException(
            'This company is already a party to the contract.',
          );
        }
        await context.parties.create({
          contractId: contract.id,
          companyId,
          partyType: invitation.partyType,
        });
        invitation.status = 'accepted';
        invitation.acceptedByCompanyUserId = actor.id;
      } else {
        invitation.status = 'rejected';
      }
      invitation.respondedAt = now;
      await context.partyInvitations.save(invitation);
      await this.writeActivity(
        context,
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
    context: IContractLifecycleContext,
    userId: string,
    companyId: string,
  ): Promise<CompanyUser> {
    const company = await context.companies.findActiveForShare(companyId);
    if (!company) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const actor = await context.memberships.findActiveForUpdate(
      userId,
      companyId,
    );
    if (!actor || actor.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only a Company Administrator can manage this contract.',
      );
    }
    return actor;
  }

  private async requireOwnedContract(
    context: IContractLifecycleContext,
    userId: string,
    companyId: string,
    contractId: string,
    allowArchived = false,
  ): Promise<{ contract: Contract; actor: CompanyUser; party: ContractParty }> {
    const contract = await context.contracts.findForUpdate(contractId);
    if (
      !contract ||
      contract.createdByCompanyId !== companyId ||
      (!allowArchived && contract.deletedAt)
    ) {
      throw new NotFoundException('Contract was not found.');
    }
    const actor = await this.requireCompanyAdmin(context, userId, companyId);
    const party = await context.parties.findForShare(contractId, companyId);
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    return { contract, actor, party };
  }

  private async requireCompanyParty(
    context: IContractLifecycleContext,
    contractId: string,
    companyId: string,
  ): Promise<void> {
    const parent = await context.contracts.findActiveById(contractId);
    if (!parent) {
      throw new NotFoundException('Parent contract was not found.');
    }
    const party = await context.parties.find(contractId, companyId);
    if (!party) {
      throw new NotFoundException(
        'Parent contract was not found for this company.',
      );
    }
  }

  private async requireUniqueSiteCode(
    context: IContractLifecycleContext,
    contractId: string,
    siteCode: string,
  ): Promise<void> {
    if (await context.sites.findByCode(contractId, siteCode.trim())) {
      throw new ConflictException(
        'A site with this code already exists on the contract.',
      );
    }
  }

  private async lockActiveContract(
    context: IContractLifecycleContext,
    contractId: string,
  ): Promise<Contract> {
    const contract = await context.contracts.findActiveForUpdate(contractId);
    if (!contract) {
      throw new NotFoundException('Contract was not found.');
    }
    return contract;
  }

  private async requireTransitionActor(
    context: IContractLifecycleContext,
    userId: string,
    companyId: string,
    contractId: string,
  ): Promise<CompanyUser> {
    const actor = await context.memberships.findActiveForUpdate(
      userId,
      companyId,
    );
    if (!actor) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const party = await context.parties.findForShare(contractId, companyId);
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    const authorizedRole = projectLeadRole(party.partyType);
    if (!authorizedRole) {
      throw new ForbiddenException(
        'This contract party cannot initiate lifecycle transitions.',
      );
    }
    const hasAssignment =
      await context.roleAssignments.hasActiveAssignmentForShare({
        companyId,
        contractPartyId: party.id,
        companyUserId: actor.id,
        role: authorizedRole,
      });
    if (!hasAssignment) {
      throw new ForbiddenException(
        'An active project lead assignment is required to change contract status.',
      );
    }
    return actor;
  }

  private async writeActivity(
    context: IContractLifecycleContext,
    contract: Contract,
    actor: CompanyUser,
    action: string,
    summary: string,
    changes: Record<string, unknown>,
    occurredAt: Date,
  ): Promise<void> {
    await context.activity.record({
      contractId: contract.id,
      companyId: actor.companyId,
      actorUserId: actor.id,
      action,
      summary,
      changes,
      occurredAt,
    });
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

function toSiteResponse(site: ContractSite): ContractSiteResponse {
  return {
    id: site.id,
    contractId: site.contractId,
    name: site.name,
    siteCode: site.siteCode,
    addressLine1: site.addressLine1,
    city: site.city,
    stateRegion: site.stateRegion,
    countryCode: site.countryCode,
    latitudeE6: site.latitudeE6,
    longitudeE6: site.longitudeE6,
    status: site.status,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}

function toSignatoryResponse(party: ContractParty): RecordedContractSignatory {
  return {
    id: party.id,
    companyId: party.companyId,
    partyType: party.partyType,
    signatoryFirstName: party.signatoryFirstName,
    signatoryLastName: party.signatoryLastName,
    signatoryTitle: party.signatoryTitle,
    signedAt: party.signedAt,
  };
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
