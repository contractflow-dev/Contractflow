import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ECompanyRole,
  contractRoleSide,
  type ContractRole,
  type ContractRoleManagementPermissions,
  type CompanyRoleAssignment,
  type IPaginatedResponse,
} from '@contractflow/contracts-schema';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  pageOffset,
  toPaginatedResponse,
} from '../../../common/application/pagination';
import type { IPageQuery } from '../../../common/application/pagination.interface';
import type { IUnitOfWork } from '../../../common/application/unit-of-work.interface';
import { MailService } from '../../mail/mail.service';
import {
  CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE,
  CONTRACT_ROLE_ASSIGNMENT_UNIT_OF_WORK,
  type IContractRoleAssignmentRepositories,
  type IContractRoleAssignmentTransactionContext,
  type IRoleAssignmentMember,
  type IRoleAssignmentParty,
  type IRoleAssignmentRecord,
  type IRoleInvitationRecord,
} from '../interfaces/contract-role-assignment-persistence.interface';
import { ContractRoleAssignmentResponseDto } from '../dto/contract-role-assignment-response.dto';
import {
  ContractRoleInvitationResponseDto,
  type ContractRoleInvitationPreviewDto,
} from '../dto/contract-role-invitation-response.dto';
import {
  WORKSPACE_ROLES,
  roleAllowedForParty,
  workspaceForRole,
  type AssignableContractWorkspace,
} from './contract-workspace';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ContractRoleAssignmentService {
  constructor(
    @Inject(CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE)
    private readonly persistence: IContractRoleAssignmentRepositories,
    @Inject(CONTRACT_ROLE_ASSIGNMENT_UNIT_OF_WORK)
    private readonly unitOfWork: IUnitOfWork<IContractRoleAssignmentTransactionContext>,
    private readonly mail: MailService,
  ) {}

  async managementPermissions(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<ContractRoleManagementPermissions> {
    const membership = await this.persistence.memberships.findActiveMember(
      companyId,
      userId,
    );
    if (!membership) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const party = await this.persistence.parties.findByContractAndCompany(
      contractId,
      companyId,
    );
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    const canGrantWorkspaceAdmin =
      membership.companyRole === ECompanyRole.COMPANY_ADMIN;
    // The contract must be visible to the caller: a role on it, or Company
    // Administrator oversight. Otherwise it is not found, not "no rights".
    if (
      !canGrantWorkspaceAdmin &&
      (
        await this.persistence.assignments.listActiveForMember(
          companyId,
          party.id,
          membership.id,
        )
      ).length === 0
    ) {
      throw new NotFoundException('Contract was not found.');
    }
    // An archived contract is read-only: its roles can't change (the write
    // paths refuse it too), so nothing is offered.
    const archived = !(await this.persistence.contracts.findActive(contractId));
    const canManage =
      !archived &&
      (canGrantWorkspaceAdmin ||
        (await this.persistence.assignments.hasWorkspaceAdmin(
          companyId,
          membership.id,
          party.id,
          WORKSPACE_ROLES[workspace],
        )));
    return {
      canManage,
      canGrantWorkspaceAdmin: canGrantWorkspaceAdmin && !archived,
      roleSide: contractRoleSide(party.partyType),
      // The workspace's roles for this party's side only.
      roles: WORKSPACE_ROLES[workspace].filter((role) =>
        roleAllowedForParty(role, party.partyType),
      ),
    };
  }

  async listEligibleMembers(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<
    Array<{ id: string; firstName: string; lastName: string; email: string }>
  > {
    await this.resolveAccess(
      this.persistence,
      userId,
      companyId,
      contractId,
      workspace,
    );
    return this.persistence.memberships.listEligible(companyId);
  }

  /**
   * Every active contract role held by the company's members, across its
   * contracts that are not archived. Company Administrators only. Read-only:
   * changes go through each contract's own role routes and their checks.
   */
  async listForCompany(
    userId: string,
    companyId: string,
    query: IPageQuery & {
      companyUserId?: string;
      workspace?: AssignableContractWorkspace;
    },
  ): Promise<IPaginatedResponse<CompanyRoleAssignment>> {
    const membership = await this.persistence.memberships.findActiveMember(
      companyId,
      userId,
    );
    if (!membership) {
      throw new ForbiddenException('Active company membership is required.');
    }
    if (membership.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only a Company Administrator can view contract roles across the company.',
      );
    }
    const page = await this.persistence.assignments.listActiveForCompany(
      companyId,
      {
        companyUserId: query.companyUserId,
        roles: query.workspace ? WORKSPACE_ROLES[query.workspace] : undefined,
      },
      { skip: pageOffset(query), take: query.limit },
    );
    const items = page.items.map((row) => ({
      id: row.id,
      contractId: row.contractId,
      contractReference: row.contractReference,
      contractTitle: row.contractTitle,
      contractStatus: row.contractStatus,
      companyUserId: row.companyUserId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      role: row.role,
      workspace: workspaceForRole(row.role),
      isWorkspaceAdmin: row.isWorkspaceAdmin,
      assignedAt: row.assignedAt.toISOString(),
    }));
    return toPaginatedResponse({ items, total: page.total }, query);
  }

  async list(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<ContractRoleAssignmentResponseDto[]> {
    const { party } = await this.resolveAccess(
      this.persistence,
      userId,
      companyId,
      contractId,
      workspace,
    );
    const rows = await this.persistence.assignments.findActiveForParty(
      companyId,
      party.id,
      contractId,
      WORKSPACE_ROLES[workspace],
    );
    return rows.map(ContractRoleAssignmentResponseDto.fromEntity);
  }

  async assign(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
    companyUserId: string,
    role: ContractRole,
    isWorkspaceAdmin = false,
  ): Promise<ContractRoleAssignmentResponseDto> {
    // Unknown values fail here too, before any transaction opens.
    if (!WORKSPACE_ROLES[workspace].includes(role)) {
      throw new BadRequestException(
        'The selected contract role does not belong to this workspace.',
      );
    }

    return this.unitOfWork.execute(async (context) => {
      const party = await this.findPartyForUpdate(
        context,
        contractId,
        companyId,
      );
      await this.assertVisibleTo(context, userId, companyId, party.id);
      await this.assertWorkspaceEnabled(context, contractId, workspace);
      if (!roleAllowedForParty(role, party.partyType)) {
        throw new BadRequestException(
          'The selected contract role is not valid for this company party.',
        );
      }
      const { actor, isCompanyAdmin } = await this.requireManagementActor(
        context,
        userId,
        companyId,
        party.id,
        workspace,
        companyUserId,
      );
      if (isWorkspaceAdmin && !isCompanyAdmin) {
        throw new ForbiddenException(
          'Only a Company Admin can grant workspace-admin privileges.',
        );
      }
      const duplicate = await context.assignments.findActiveDuplicate(
        companyId,
        party.id,
        companyUserId,
        role,
      );
      if (duplicate) {
        throw new ConflictException(
          'This member already has the selected active contract role.',
        );
      }

      const now = new Date();
      const assignment = await context.assignments.create(companyId, {
        contractPartyId: party.id,
        companyUserId,
        role,
        isWorkspaceAdmin,
        assignedAt: now,
        assignedById: actor.id,
        revokedAt: null,
        revokedById: null,
      });
      await this.writeAssignmentActivity(
        context,
        contractId,
        companyId,
        actor.id,
        assignment,
        'contract.role_assigned',
        workspace,
        null,
        { companyUserId, role, isWorkspaceAdmin },
        now,
      );
      return ContractRoleAssignmentResponseDto.fromEntity(
        await this.loadAssignment(context, assignment.id, party.id, companyId),
      );
    });
  }

  async revoke(
    userId: string,
    companyId: string,
    contractId: string,
    assignmentId: string,
  ): Promise<ContractRoleAssignmentResponseDto> {
    return this.unitOfWork.execute(async (context) => {
      const party = await this.findPartyForUpdate(
        context,
        contractId,
        companyId,
      );
      await this.assertVisibleTo(context, userId, companyId, party.id);
      const assignment = await context.assignments.findByIdInPartyForUpdate(
        companyId,
        assignmentId,
        party.id,
      );
      if (!assignment) {
        throw new NotFoundException('Contract role assignment was not found.');
      }
      if (assignment.revokedAt) {
        throw new ConflictException(
          'This contract role assignment has already been revoked.',
        );
      }
      const workspace = workspaceForRole(assignment.role);
      const { actor } = await this.requireManagementActor(
        context,
        userId,
        companyId,
        party.id,
        workspace,
      );
      if (
        assignment.isWorkspaceAdmin &&
        (await context.assignments.countActiveWorkspaceAdmins(
          companyId,
          party.id,
          WORKSPACE_ROLES[workspace],
        )) <= 1
      ) {
        throw new ConflictException(
          'Assign another workspace administrator before revoking this role.',
        );
      }

      const revokedAt = new Date();
      await context.assignments.revoke(assignment, revokedAt, actor.id);
      await this.writeAssignmentActivity(
        context,
        contractId,
        companyId,
        actor.id,
        assignment,
        'contract.role_revoked',
        workspace,
        {
          companyUserId: assignment.companyUserId,
          role: assignment.role,
          isWorkspaceAdmin: assignment.isWorkspaceAdmin,
        },
        null,
        revokedAt,
      );
      return ContractRoleAssignmentResponseDto.fromEntity(
        await this.loadAssignment(context, assignment.id, party.id, companyId),
      );
    });
  }

  async setWorkspaceAdmin(
    userId: string,
    companyId: string,
    contractId: string,
    assignmentId: string,
    isWorkspaceAdmin: boolean,
  ): Promise<ContractRoleAssignmentResponseDto> {
    return this.unitOfWork.execute(async (context) => {
      const party = await this.findPartyForUpdate(
        context,
        contractId,
        companyId,
      );
      await this.assertVisibleTo(context, userId, companyId, party.id);
      const { actor, isCompanyAdmin } = await this.requireManagementActor(
        context,
        userId,
        companyId,
        party.id,
        undefined,
      );
      if (!isCompanyAdmin) {
        throw new ForbiddenException(
          'Only a Company Admin can grant or revoke workspace-admin privileges.',
        );
      }
      const assignment = await context.assignments.findByIdInPartyForUpdate(
        companyId,
        assignmentId,
        party.id,
      );
      if (!assignment || assignment.revokedAt) {
        throw new NotFoundException(
          'Active contract role assignment was not found.',
        );
      }
      if (assignment.isWorkspaceAdmin === isWorkspaceAdmin) {
        return ContractRoleAssignmentResponseDto.fromEntity(
          await this.loadAssignment(
            context,
            assignment.id,
            party.id,
            companyId,
          ),
        );
      }
      const workspace = workspaceForRole(assignment.role);
      if (
        !isWorkspaceAdmin &&
        (await context.assignments.countActiveWorkspaceAdmins(
          companyId,
          party.id,
          WORKSPACE_ROLES[workspace],
        )) <= 1
      ) {
        throw new ConflictException(
          'Assign another workspace administrator before removing this privilege.',
        );
      }
      const before = { isWorkspaceAdmin: assignment.isWorkspaceAdmin };
      assignment.isWorkspaceAdmin = isWorkspaceAdmin;
      await context.assignments.save(assignment);
      await this.writeAssignmentActivity(
        context,
        contractId,
        companyId,
        actor.id,
        assignment,
        isWorkspaceAdmin
          ? 'contract.workspace_admin_granted'
          : 'contract.workspace_admin_revoked',
        workspace,
        before,
        { isWorkspaceAdmin },
        new Date(),
      );
      return ContractRoleAssignmentResponseDto.fromEntity(
        await this.loadAssignment(context, assignment.id, party.id, companyId),
      );
    });
  }

  async listInvitations(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<ContractRoleInvitationResponseDto[]> {
    const { party } = await this.resolveAccess(
      this.persistence,
      userId,
      companyId,
      contractId,
      workspace,
    );
    await this.persistence.invitations.expireForParty(
      party.id,
      workspace,
      new Date(),
    );
    const invitations = await this.persistence.invitations.listForParty(
      companyId,
      party.id,
      workspace,
    );
    return invitations.map(ContractRoleInvitationResponseDto.fromEntity);
  }

  async invite(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
    email: string,
    role: ContractRole,
    isWorkspaceAdmin = false,
  ): Promise<ContractRoleInvitationResponseDto> {
    // Unknown values fail here too, before any transaction opens.
    if (!WORKSPACE_ROLES[workspace].includes(role)) {
      throw new BadRequestException(
        'The selected contract role does not belong to this workspace.',
      );
    }
    return this.unitOfWork.execute(async (context) => {
      const party = await this.findPartyForUpdate(
        context,
        contractId,
        companyId,
      );
      await this.assertVisibleTo(context, userId, companyId, party.id);
      await this.assertWorkspaceEnabled(context, contractId, workspace);
      if (!roleAllowedForParty(role, party.partyType)) {
        throw new BadRequestException(
          'The selected contract role is not valid for this company party.',
        );
      }
      const { actor, isCompanyAdmin } = await this.requireManagementActor(
        context,
        userId,
        companyId,
        party.id,
        workspace,
      );
      if (isWorkspaceAdmin && !isCompanyAdmin) {
        throw new ForbiddenException(
          'Only a Company Admin can invite a workspace administrator.',
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      const now = new Date();
      await context.invitations.expirePending(
        party.id,
        normalizedEmail,
        role,
        now,
      );
      if (
        await context.invitations.findPending(party.id, normalizedEmail, role)
      ) {
        throw new ConflictException(
          'A pending invitation already exists for this email and role.',
        );
      }
      const member = await context.memberships.findActiveByEmail(
        companyId,
        normalizedEmail,
      );
      if (
        member &&
        (await context.assignments.findActiveDuplicate(
          companyId,
          party.id,
          member.id,
          role,
        ))
      ) {
        throw new ConflictException(
          'This member already has the selected active contract role.',
        );
      }

      const token = randomBytes(32).toString('base64url');
      const saved = await context.invitations.create({
        contractPartyId: party.id,
        companyId,
        invitedById: actor.id,
        email: normalizedEmail,
        role,
        workspace,
        isWorkspaceAdmin,
        tokenHash: hashInvitationToken(token),
        status: 'pending',
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        respondedAt: null,
        revokedAt: null,
      });
      const [contract, companyName] = await Promise.all([
        context.contracts.findInvitationDetails(contractId),
        context.companies.findName(companyId),
      ]);
      if (!contract || !companyName) {
        throw new NotFoundException('Contract or company was not found.');
      }
      await this.mail.sendContractRoleInvitationEmail(
        normalizedEmail,
        contract.title,
        role,
        workspace,
        token,
        companyName,
      );
      await this.writeInvitationActivity(
        context,
        contractId,
        companyId,
        actor.id,
        saved,
        'contract.role_invitation_created',
        now,
      );
      return ContractRoleInvitationResponseDto.fromEntity(saved);
    });
  }

  async revokeInvitation(
    userId: string,
    companyId: string,
    contractId: string,
    invitationId: string,
  ): Promise<ContractRoleInvitationResponseDto> {
    return this.unitOfWork.execute(async (context) => {
      const party = await this.findPartyForUpdate(
        context,
        contractId,
        companyId,
      );
      await this.assertVisibleTo(context, userId, companyId, party.id);
      const invitation = await context.invitations.findByIdForUpdate(
        invitationId,
        party.id,
        companyId,
      );
      if (!invitation) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const { actor } = await this.requireManagementActor(
        context,
        userId,
        companyId,
        party.id,
        invitation.workspace,
      );
      if (invitation.status !== 'pending' || invitation.revokedAt) {
        throw new ConflictException('This invitation is no longer pending.');
      }
      const now = new Date();
      if (invitation.expiresAt <= now) {
        invitation.status = 'expired';
        await context.invitations.save(invitation);
        return ContractRoleInvitationResponseDto.fromEntity(invitation);
      }
      invitation.status = 'revoked';
      invitation.revokedAt = now;
      await context.invitations.save(invitation);
      await this.writeInvitationActivity(
        context,
        contractId,
        companyId,
        actor.id,
        invitation,
        'contract.role_invitation_revoked',
        now,
      );
      return ContractRoleInvitationResponseDto.fromEntity(invitation);
    });
  }

  async previewInvitation(
    token: string,
  ): Promise<ContractRoleInvitationPreviewDto> {
    const hash = hashInvitationToken(token);
    const invitation = await this.persistence.invitations.findByTokenHash(hash);
    if (!invitation) {
      throw new NotFoundException('Contract role invitation was not found.');
    }
    if (invitation.status !== 'pending' || invitation.revokedAt) {
      throw new ConflictException('This invitation is no longer active.');
    }
    if (invitation.expiresAt <= new Date()) {
      await this.persistence.invitations.expireById(invitation.id);
      throw new ConflictException('This invitation has expired.');
    }
    const party = await this.persistence.parties.findByIdAndCompany(
      invitation.contractPartyId,
      invitation.companyId,
    );
    if (!party) {
      throw new NotFoundException('Contract role invitation was not found.');
    }
    const [contract, companyName] = await Promise.all([
      this.persistence.contracts.findInvitationDetails(party.contractId),
      this.persistence.companies.findName(invitation.companyId),
    ]);
    if (!contract || !companyName) {
      throw new NotFoundException('Contract or company was not found.');
    }
    await this.assertWorkspaceEnabled(
      this.persistence,
      party.contractId,
      invitation.workspace,
    );
    return {
      contractTitle: contract.title,
      companyName,
      email: invitation.email,
      role: invitation.role,
      workspace: invitation.workspace,
      isWorkspaceAdmin: invitation.isWorkspaceAdmin,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async respondToInvitation(
    userId: string,
    userEmail: string,
    isEmailVerified: boolean,
    token: string,
    decision: 'accept' | 'decline',
  ): Promise<{
    status: 'accepted' | 'rejected';
    assignment?: ContractRoleAssignmentResponseDto;
  }> {
    if (!isEmailVerified) {
      throw new ForbiddenException(
        'Verify your email address before responding to an invitation.',
      );
    }
    const tokenHash = hashInvitationToken(token);
    const initial =
      await this.persistence.invitations.findByTokenHash(tokenHash);
    if (!initial) {
      throw new NotFoundException('Contract role invitation was not found.');
    }
    const result = await this.unitOfWork.execute(async (context) => {
      const initialParty = await context.parties.findByIdAndCompany(
        initial.contractPartyId,
        initial.companyId,
      );
      if (!initialParty) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const contract = await context.contracts.findActiveForUpdate(
        initialParty.contractId,
      );
      if (!contract) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const party = await context.parties.findByIdAndCompanyForUpdate(
        initial.contractPartyId,
        initial.companyId,
      );
      if (!party) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const invitation = await context.invitations.findByIdForUpdate(
        initial.id,
        initial.contractPartyId,
        initial.companyId,
        tokenHash,
      );
      if (!invitation) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      if (invitation.email !== userEmail.trim().toLowerCase()) {
        throw new ForbiddenException(
          'Sign in with the email address that received this invitation.',
        );
      }
      if (invitation.status !== 'pending' || invitation.revokedAt) {
        throw new ConflictException('This invitation has already been used.');
      }
      const now = new Date();
      if (invitation.expiresAt <= now) {
        invitation.status = 'expired';
        await context.invitations.save(invitation);
        return { status: 'expired' as const };
      }
      if (decision === 'decline') {
        invitation.status = 'rejected';
        invitation.respondedAt = now;
        await context.invitations.save(invitation);
        return { status: 'rejected' as const };
      }
      const member = await context.memberships.findActiveMember(
        invitation.companyId,
        userId,
      );
      const lockedMember = member
        ? await context.memberships.findActiveById(
            invitation.companyId,
            member.id,
          )
        : null;
      if (!lockedMember) {
        throw new ConflictException(
          'Join this company before accepting its contract role invitation.',
        );
      }
      await this.assertWorkspaceEnabled(
        context,
        party.contractId,
        invitation.workspace,
      );
      if (!roleAllowedForParty(invitation.role, party.partyType)) {
        throw new ConflictException(
          'This contract role is no longer valid for the company party.',
        );
      }
      if (
        await context.assignments.findActiveDuplicate(
          invitation.companyId,
          party.id,
          lockedMember.id,
          invitation.role,
        )
      ) {
        throw new ConflictException(
          'This member already has the selected active contract role.',
        );
      }

      const assignment = await context.assignments.create(
        invitation.companyId,
        {
          contractPartyId: party.id,
          companyUserId: lockedMember.id,
          role: invitation.role,
          isWorkspaceAdmin: invitation.isWorkspaceAdmin,
          assignedAt: now,
          assignedById: invitation.invitedById,
          revokedAt: null,
          revokedById: null,
        },
      );
      await this.writeAssignmentActivity(
        context,
        party.contractId,
        invitation.companyId,
        lockedMember.id,
        assignment,
        'contract.role_assigned',
        invitation.workspace,
        null,
        {
          companyUserId: lockedMember.id,
          role: invitation.role,
          isWorkspaceAdmin: invitation.isWorkspaceAdmin,
          invitationId: invitation.id,
        },
        now,
      );
      invitation.status = 'accepted';
      invitation.respondedAt = now;
      await context.invitations.save(invitation);
      return {
        status: 'accepted' as const,
        assignment: ContractRoleAssignmentResponseDto.fromEntity(
          await this.loadAssignment(
            context,
            assignment.id,
            party.id,
            invitation.companyId,
          ),
        ),
      };
    });
    if (result.status === 'expired') {
      throw new ConflictException('This invitation has expired.');
    }
    return result;
  }

  private async resolveAccess(
    repositories: IContractRoleAssignmentRepositories,
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<{ party: IRoleAssignmentParty }> {
    // Membership and visibility first: nothing about a contract the caller
    // can't see (whether it exists, its workspaces) is revealed by the order
    // of the checks below.
    const membership = await repositories.memberships.findActiveMember(
      companyId,
      userId,
    );
    if (!membership) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const party = await repositories.parties.findByContractAndCompany(
      contractId,
      companyId,
    );
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    await this.assertVisible(repositories, companyId, party.id, membership);
    const contract = await repositories.contracts.findActive(contractId);
    if (!contract) {
      throw new NotFoundException('Contract was not found.');
    }
    await this.assertWorkspaceEnabled(repositories, contractId, workspace);
    if (
      membership.companyRole !== ECompanyRole.COMPANY_ADMIN &&
      !(await repositories.assignments.hasWorkspaceAdmin(
        companyId,
        membership.id,
        party.id,
        WORKSPACE_ROLES[workspace],
      ))
    ) {
      throw new ForbiddenException(
        'Workspace administrator access is required to manage contract roles.',
      );
    }
    return { party };
  }

  /**
   * The contract visibility rule (see ContractAccessService): a Company
   * Administrator of the party company, or a member holding an active role
   * on this party. Anyone else gets the same 404 as for a missing contract,
   * so a later 403 or 404 never confirms what the contract holds.
   */
  private async assertVisible(
    repositories: IContractRoleAssignmentRepositories,
    companyId: string,
    partyId: string,
    member: IRoleAssignmentMember,
  ): Promise<void> {
    if (member.companyRole === ECompanyRole.COMPANY_ADMIN) return;
    const roles = await repositories.assignments.listActiveForMember(
      companyId,
      partyId,
      member.id,
    );
    if (roles.length === 0) {
      throw new NotFoundException('Contract was not found.');
    }
  }

  /** `assertVisible` for the signed-in user, inside a write's transaction. */
  private async assertVisibleTo(
    context: IContractRoleAssignmentTransactionContext,
    userId: string,
    companyId: string,
    partyId: string,
  ): Promise<void> {
    const member = await context.memberships.findActiveMember(
      companyId,
      userId,
    );
    if (!member) {
      throw new ForbiddenException('Active company membership is required.');
    }
    await this.assertVisible(context, companyId, partyId, member);
  }

  private async findPartyForUpdate(
    context: IContractRoleAssignmentTransactionContext,
    contractId: string,
    companyId: string,
  ): Promise<IRoleAssignmentParty> {
    const party = await context.parties.findForUpdate(contractId, companyId);
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    return party;
  }

  private async assertWorkspaceEnabled(
    repositories: IContractRoleAssignmentRepositories,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<void> {
    if (!(await repositories.workspaces.exists(contractId, workspace))) {
      throw new NotFoundException('Contract workspace was not found.');
    }
  }

  private async requireManagementActor(
    context: IContractRoleAssignmentTransactionContext,
    actorUserId: string,
    companyId: string,
    contractPartyId: string,
    workspace: AssignableContractWorkspace | undefined,
    targetCompanyUserId?: string,
  ): Promise<{ actor: IRoleAssignmentMember; isCompanyAdmin: boolean }> {
    const actorMembership = await context.memberships.findActiveMember(
      companyId,
      actorUserId,
    );
    if (!actorMembership) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const memberIds = [
      ...new Set(
        [actorMembership.id, targetCompanyUserId].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    ].sort();
    const locked = new Map<string, IRoleAssignmentMember>();
    for (const id of memberIds) {
      const member = await context.memberships.findActiveById(companyId, id);
      if (member) locked.set(id, member);
    }
    const actor = locked.get(actorMembership.id);
    if (!actor) {
      throw new ForbiddenException('Active company membership is required.');
    }
    if (targetCompanyUserId && !locked.has(targetCompanyUserId)) {
      throw new NotFoundException('Active company member was not found.');
    }
    const isCompanyAdmin = actor.companyRole === ECompanyRole.COMPANY_ADMIN;
    const hasWorkspaceAdmin =
      !isCompanyAdmin &&
      workspace !== undefined &&
      (await context.assignments.hasWorkspaceAdmin(
        companyId,
        actor.id,
        contractPartyId,
        WORKSPACE_ROLES[workspace],
      ));
    if (!isCompanyAdmin && !hasWorkspaceAdmin) {
      throw new ForbiddenException(
        workspace
          ? 'Workspace administrator access is required to manage contract roles.'
          : 'Company administrator access is required to manage workspace privileges.',
      );
    }
    return { actor, isCompanyAdmin };
  }

  private async writeAssignmentActivity(
    context: IContractRoleAssignmentTransactionContext,
    contractId: string,
    companyId: string,
    actorCompanyUserId: string,
    assignment: IRoleAssignmentRecord,
    action: string,
    workspace: AssignableContractWorkspace,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    occurredAt: Date,
  ): Promise<void> {
    await context.activities.write({
      contractId,
      companyId,
      actorUserId: actorCompanyUserId,
      action,
      entityType: 'contract_role_assignment',
      entityId: randomUUID(),
      summary:
        action === 'contract.role_assigned'
          ? `Assigned ${assignment.role} to a company member in the ${workspace} workspace.`
          : `Revoked ${assignment.role} from a company member in the ${workspace} workspace.`,
      changes: { before, after },
      metadata: {
        assignmentId: assignment.id,
        contractPartyId: assignment.contractPartyId,
        targetCompanyUserId: assignment.companyUserId,
        workspace,
      },
      ipAddress: null,
      userAgent: null,
      requestId: null,
      occurredAt,
    });
  }

  private async writeInvitationActivity(
    context: IContractRoleAssignmentTransactionContext,
    contractId: string,
    companyId: string,
    actorCompanyUserId: string,
    invitation: IRoleInvitationRecord,
    action: string,
    occurredAt: Date,
  ): Promise<void> {
    await context.activities.write({
      contractId,
      companyId,
      actorUserId: actorCompanyUserId,
      action,
      entityType: 'contract_role_invitation',
      entityId: randomUUID(),
      summary: `Created or revoked a ${invitation.workspace} role invitation for ${invitation.email}.`,
      changes: {
        before: null,
        after: {
          invitationId: invitation.id,
          email: invitation.email,
          role: invitation.role,
          workspace: invitation.workspace,
          isWorkspaceAdmin: invitation.isWorkspaceAdmin,
          status: invitation.status,
        },
      },
      metadata: {
        invitationId: invitation.id,
        contractPartyId: invitation.contractPartyId,
        workspace: invitation.workspace,
      },
      ipAddress: null,
      userAgent: null,
      requestId: null,
      occurredAt,
    });
  }

  private async loadAssignment(
    context: IContractRoleAssignmentTransactionContext,
    id: string,
    contractPartyId: string,
    companyId: string,
  ): Promise<IRoleAssignmentRecord> {
    const assignment = await context.assignments.load(
      companyId,
      contractPartyId,
      id,
    );
    if (!assignment) {
      throw new NotFoundException('Contract role assignment was not found.');
    }
    return assignment;
  }
}
