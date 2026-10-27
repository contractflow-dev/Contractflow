import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EContractRole,
} from '@contractflow/contracts-schema';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  DataSource,
  IsNull,
  LessThanOrEqual,
  Repository,
  type EntityManager,
} from 'typeorm';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { ActivityLog } from '../../cross-cutting/entities/activity-log.entity';
import { MailService } from '../../mail/mail.service';
import { CompanyUser } from '../../identity/entities/company-user.entity';
import { CompanyUserRepository } from '../../identity/repositories/company-user.respository';
import { Company } from '../../identity/entities/company.entity';
import { Contract } from '../entities/contract.entity';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractRoleAssignment } from '../entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from '../entities/contract-role-invitation.entity';
import type { ContractRoleInvitationStatus } from '../entities/contract-role-invitation.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import { ContractRoleAssignmentResponseDto } from '../dto/contract-role-assignment-response.dto';
import {
  ContractRoleInvitationResponseDto,
  type ContractRoleInvitationPreviewDto,
} from '../dto/contract-role-invitation-response.dto';
import { ContractRoleAssignmentRepository } from '../repositories/contract-role-assignment.repository';
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
    private readonly dataSource: DataSource,
    private readonly assignments: ContractRoleAssignmentRepository,
    private readonly companyUsers: CompanyUserRepository,
    private readonly mail: MailService,
    @InjectRepository(ContractParty)
    private readonly parties: Repository<ContractParty>,
  ) {}

  async managementPermissions(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<{ canManage: boolean; canGrantWorkspaceAdmin: boolean }> {
    const membership = await this.companyUsers.findActiveMember(userId, {
      companyId,
    });
    if (!membership) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const party = await this.parties.findOne({
      where: { contractId, companyId },
    });
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    const canGrantWorkspaceAdmin =
      membership.companyRole === ECompanyRole.COMPANY_ADMIN;
    const canManage =
      canGrantWorkspaceAdmin ||
      (await this.assignments.hasWorkspaceAdmin(
        membership.id,
        party.id,
        WORKSPACE_ROLES[workspace],
        { companyId },
      ));
    return { canManage, canGrantWorkspaceAdmin };
  }

  async listEligibleMembers(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<
    Array<{ id: string; firstName: string; lastName: string; email: string }>
  > {
    await this.resolveAccess(userId, companyId, contractId, workspace);
    const members = await this.dataSource
      .getRepository(CompanyUser)
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .where('membership.companyId = :companyId', { companyId })
      .andWhere('membership.status = :active', {
        active: ECompanyUserStatus.ACTIVE,
      })
      .andWhere('membership.leftAt IS NULL')
      .orderBy('user.lastName', 'ASC')
      .addOrderBy('user.firstName', 'ASC')
      .addOrderBy('membership.id', 'ASC')
      .getMany();
    return members.map((member) => ({
      id: member.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      email: member.user.email,
    }));
  }

  async list(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<ContractRoleAssignmentResponseDto[]> {
    const { party } = await this.resolveAccess(
      userId,
      companyId,
      contractId,
      workspace,
    );

    const rows = await this.assignments.findActiveForParty(
      party.id,
      contractId,
      WORKSPACE_ROLES[workspace],
      { companyId },
    );
    return rows.map(ContractRoleAssignmentResponseDto.fromEntity);
  }

  async assign(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
    companyUserId: string,
    role: EContractRole,
    isWorkspaceAdmin = false,
  ): Promise<ContractRoleAssignmentResponseDto> {
    if (workspaceForRole(role) !== workspace) {
      throw new BadRequestException(
        'The selected contract role does not belong to this workspace.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const party = await this.findPartyForUpdate(
        manager.getRepository(ContractParty),
        contractId,
        companyId,
      );
      await this.assertWorkspaceEnabled(manager, contractId, workspace);
      if (!roleAllowedForParty(role, party.partyType)) {
        throw new BadRequestException(
          'The selected contract role is not valid for this company party.',
        );
      }
      const { actor, isCompanyAdmin } = await this.requireManagementActor(
        manager.getRepository(CompanyUser),
        userId,
        companyId,
        party.id,
        workspace,
        manager,
        companyUserId,
      );
      if (isWorkspaceAdmin && !isCompanyAdmin) {
        throw new ForbiddenException(
          'Only a Company Admin can grant workspace-admin privileges.',
        );
      }
      const scope: ICompanyScope = { companyId };

      const duplicate = await this.assignments.findActiveDuplicate(
        party.id,
        companyUserId,
        role,
        scope,
        manager,
      );
      if (duplicate) {
        throw new ConflictException(
          'This member already has the selected active contract role.',
        );
      }

      const now = new Date();
      const assignment = await this.assignments.createInScope(
        {
          contractPartyId: party.id,
          companyUserId,
          role,
          isWorkspaceAdmin,
          assignedAt: now,
          assignedById: actor.id,
          revokedAt: null,
          revokedById: null,
        },
        scope,
        manager,
      );

      await this.writeActivity(
        manager,
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
        await this.loadAssignment(
          manager.getRepository(ContractRoleAssignment),
          assignment.id,
          party.id,
          companyId,
        ),
      );
    });
  }

  async revoke(
    userId: string,
    companyId: string,
    contractId: string,
    assignmentId: string,
  ): Promise<ContractRoleAssignmentResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const party = await this.findPartyForUpdate(
        manager.getRepository(ContractParty),
        contractId,
        companyId,
      );
      const assignment = await this.assignments.findByIdInPartyForUpdate(
        assignmentId,
        party.id,
        { companyId },
        manager,
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
        manager.getRepository(CompanyUser),
        userId,
        companyId,
        party.id,
        workspace,
        manager,
      );
      if (
        assignment.isWorkspaceAdmin &&
        (await this.assignments.countActiveWorkspaceAdmins(
          party.id,
          WORKSPACE_ROLES[workspace],
          { companyId },
          manager,
        )) <= 1
      ) {
        throw new ConflictException(
          'Assign another workspace administrator before revoking this role.',
        );
      }

      const revokedAt = new Date();
      await this.assignments.revokeInScope(
        assignment,
        revokedAt,
        actor.id,
        manager,
      );
      await this.writeActivity(
        manager,
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
        await this.loadAssignment(
          manager.getRepository(ContractRoleAssignment),
          assignment.id,
          party.id,
          companyId,
        ),
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
    return this.dataSource.transaction(async (manager) => {
      const party = await this.findPartyForUpdate(
        manager.getRepository(ContractParty),
        contractId,
        companyId,
      );
      const { actor, isCompanyAdmin } = await this.requireManagementActor(
        manager.getRepository(CompanyUser),
        userId,
        companyId,
        party.id,
        undefined,
        manager,
      );
      if (!isCompanyAdmin) {
        throw new ForbiddenException(
          'Only a Company Admin can grant or revoke workspace-admin privileges.',
        );
      }

      const assignment = await this.assignments.findByIdInPartyForUpdate(
        assignmentId,
        party.id,
        { companyId },
        manager,
      );
      if (!assignment || assignment.revokedAt) {
        throw new NotFoundException(
          'Active contract role assignment was not found.',
        );
      }
      if (assignment.isWorkspaceAdmin === isWorkspaceAdmin) {
        return ContractRoleAssignmentResponseDto.fromEntity(
          await this.loadAssignment(
            manager.getRepository(ContractRoleAssignment),
            assignment.id,
            party.id,
            companyId,
          ),
        );
      }

      const workspace = workspaceForRole(assignment.role);
      if (
        !isWorkspaceAdmin &&
        (await this.assignments.countActiveWorkspaceAdmins(
          party.id,
          WORKSPACE_ROLES[workspace],
          { companyId },
          manager,
        )) <= 1
      ) {
        throw new ConflictException(
          'Assign another workspace administrator before removing this privilege.',
        );
      }

      const before = { isWorkspaceAdmin: assignment.isWorkspaceAdmin };
      assignment.isWorkspaceAdmin = isWorkspaceAdmin;
      await manager.getRepository(ContractRoleAssignment).save(assignment);
      await this.writeActivity(
        manager,
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
        await this.loadAssignment(
          manager.getRepository(ContractRoleAssignment),
          assignment.id,
          party.id,
          companyId,
        ),
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
      userId,
      companyId,
      contractId,
      workspace,
    );
    const repository = this.dataSource.getRepository(ContractRoleInvitation);
    await repository.update(
      {
        contractPartyId: party.id,
        workspace,
        status: 'pending',
        expiresAt: LessThanOrEqual(new Date()),
      },
      { status: 'expired' },
    );
    const invitations = await repository.find({
      where: { contractPartyId: party.id, companyId, workspace },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return invitations.map(ContractRoleInvitationResponseDto.fromEntity);
  }

  async invite(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
    email: string,
    role: EContractRole,
    isWorkspaceAdmin = false,
  ): Promise<ContractRoleInvitationResponseDto> {
    if (workspaceForRole(role) !== workspace) {
      throw new BadRequestException(
        'The selected contract role does not belong to this workspace.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const party = await this.findPartyForUpdate(
        manager.getRepository(ContractParty),
        contractId,
        companyId,
      );
      await this.assertWorkspaceEnabled(manager, contractId, workspace);
      if (!roleAllowedForParty(role, party.partyType)) {
        throw new BadRequestException(
          'The selected contract role is not valid for this company party.',
        );
      }
      const { actor, isCompanyAdmin } = await this.requireManagementActor(
        manager.getRepository(CompanyUser),
        userId,
        companyId,
        party.id,
        workspace,
        manager,
      );
      if (isWorkspaceAdmin && !isCompanyAdmin) {
        throw new ForbiddenException(
          'Only a Company Admin can invite a workspace administrator.',
        );
      }

      const normalizedEmail = email.trim().toLowerCase();
      const now = new Date();
      const invitations = manager.getRepository(ContractRoleInvitation);
      await invitations.update(
        {
          contractPartyId: party.id,
          email: normalizedEmail,
          role,
          status: 'pending',
          expiresAt: LessThanOrEqual(now),
        },
        { status: 'expired' },
      );
      const existingInvitation = await invitations.findOne({
        where: {
          contractPartyId: party.id,
          email: normalizedEmail,
          role,
          status: 'pending',
        },
      });
      if (existingInvitation) {
        throw new ConflictException(
          'A pending invitation already exists for this email and role.',
        );
      }

      const member = await manager
        .getRepository(CompanyUser)
        .createQueryBuilder('membership')
        .innerJoin('membership.user', 'user')
        .where('membership.companyId = :companyId', { companyId })
        .andWhere('membership.status = :active', {
          active: ECompanyUserStatus.ACTIVE,
        })
        .andWhere('membership.leftAt IS NULL')
        .andWhere('LOWER(user.email) = :email', { email: normalizedEmail })
        .getOne();
      if (
        member &&
        (await this.assignments.findActiveDuplicate(
          party.id,
          member.id,
          role,
          { companyId },
          manager,
        ))
      ) {
        throw new ConflictException(
          'This member already has the selected active contract role.',
        );
      }

      const token = randomBytes(32).toString('base64url');
      const invitation = invitations.create({
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
      const saved = await invitations.save(invitation);
      const [contract, company] = await Promise.all([
        manager.getRepository(Contract).findOne({
          where: { id: contractId },
          select: { id: true, title: true },
        }),
        manager.getRepository(Company).findOne({
          where: { id: companyId },
          select: { id: true, name: true },
        }),
      ]);
      if (!contract || !company) {
        throw new NotFoundException('Contract or company was not found.');
      }
      await this.mail.sendContractRoleInvitationEmail(
        normalizedEmail,
        contract.title,
        role,
        workspace,
        token,
      );
      await this.writeInvitationActivity(
        manager,
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
    return this.dataSource.transaction(async (manager) => {
      const party = await this.findPartyForUpdate(
        manager.getRepository(ContractParty),
        contractId,
        companyId,
      );
      const invitations = manager.getRepository(ContractRoleInvitation);
      const invitation = await invitations.findOne({
        where: { id: invitationId, contractPartyId: party.id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invitation) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const { actor } = await this.requireManagementActor(
        manager.getRepository(CompanyUser),
        userId,
        companyId,
        party.id,
        invitation.workspace,
        manager,
      );
      if (invitation.status !== 'pending' || invitation.revokedAt) {
        throw new ConflictException('This invitation is no longer pending.');
      }
      const now = new Date();
      if (invitation.expiresAt <= now) {
        invitation.status = 'expired';
        await invitations.save(invitation);
        return ContractRoleInvitationResponseDto.fromEntity(invitation);
      }
      invitation.status = 'revoked';
      invitation.revokedAt = now;
      await invitations.save(invitation);
      await this.writeInvitationActivity(
        manager,
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
    const invitation = await this.dataSource
      .getRepository(ContractRoleInvitation)
      .findOne({ where: { tokenHash: hash } });
    if (!invitation) {
      throw new NotFoundException('Contract role invitation was not found.');
    }
    if (invitation.status !== 'pending' || invitation.revokedAt) {
      throw new ConflictException('This invitation is no longer active.');
    }
    if (invitation.expiresAt <= new Date()) {
      await this.dataSource
        .getRepository(ContractRoleInvitation)
        .update(
          { id: invitation.id, status: 'pending' },
          { status: 'expired' },
        );
      throw new ConflictException('This invitation has expired.');
    }
    const party = await this.parties.findOne({
      where: {
        id: invitation.contractPartyId,
        companyId: invitation.companyId,
      },
    });
    if (!party) {
      throw new NotFoundException('Contract role invitation was not found.');
    }
    const [contract, company] = await Promise.all([
      this.dataSource.getRepository(Contract).findOne({
        where: { id: party.contractId, deletedAt: IsNull() },
        select: { id: true, title: true },
      }),
      this.dataSource.getRepository(Company).findOne({
        where: { id: invitation.companyId },
        select: { id: true, name: true },
      }),
    ]);
    if (!contract || !company) {
      throw new NotFoundException('Contract or company was not found.');
    }
    await this.assertWorkspaceEnabled(
      this.dataSource.manager,
      party.contractId,
      invitation.workspace,
    );
    return {
      contractTitle: contract.title,
      companyName: company.name,
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
    status: ContractRoleInvitationStatus;
    assignment?: ContractRoleAssignmentResponseDto;
  }> {
    if (!isEmailVerified) {
      throw new ForbiddenException(
        'Verify your email address before responding to an invitation.',
      );
    }
    const tokenHash = hashInvitationToken(token);
    const initial = await this.dataSource
      .getRepository(ContractRoleInvitation)
      .findOne({ where: { tokenHash } });
    if (!initial) {
      throw new NotFoundException('Contract role invitation was not found.');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const initialParty = await manager
        .getRepository(ContractParty)
        .findOne({ where: { id: initial.contractPartyId } });
      if (!initialParty) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const contract = await manager.getRepository(Contract).findOne({
        where: { id: initialParty.contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const party = await manager.getRepository(ContractParty).findOne({
        where: {
          id: initial.contractPartyId,
          companyId: initial.companyId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!party) {
        throw new NotFoundException('Contract role invitation was not found.');
      }
      const invitations = manager.getRepository(ContractRoleInvitation);
      const invitation = await invitations.findOne({
        where: { id: initial.id, tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
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
        await invitations.save(invitation);
        return { status: 'expired' as const };
      }

      if (decision === 'decline') {
        invitation.status = 'rejected';
        invitation.respondedAt = now;
        await invitations.save(invitation);
        return { status: 'rejected' as const };
      }

      const members = manager.getRepository(CompanyUser);
      const member = await members.findOne({
        where: {
          userId,
          companyId: invitation.companyId,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!member) {
        throw new ConflictException(
          'Join this company before accepting its contract role invitation.',
        );
      }
      await this.assertWorkspaceEnabled(
        manager,
        party.contractId,
        invitation.workspace,
      );
      if (!roleAllowedForParty(invitation.role, party.partyType)) {
        throw new ConflictException(
          'This contract role is no longer valid for the company party.',
        );
      }
      if (
        await this.assignments.findActiveDuplicate(
          party.id,
          member.id,
          invitation.role,
          { companyId: invitation.companyId },
          manager,
        )
      ) {
        throw new ConflictException(
          'This member already has the selected active contract role.',
        );
      }

      const assignment = await this.assignments.createInScope(
        {
          contractPartyId: party.id,
          companyUserId: member.id,
          role: invitation.role,
          isWorkspaceAdmin: invitation.isWorkspaceAdmin,
          assignedAt: now,
          assignedById: invitation.invitedById,
          revokedAt: null,
          revokedById: null,
        },
        { companyId: invitation.companyId },
        manager,
      );
      await this.writeActivity(
        manager,
        party.contractId,
        invitation.companyId,
        member.id,
        assignment,
        'contract.role_assigned',
        invitation.workspace,
        null,
        {
          companyUserId: member.id,
          role: invitation.role,
          isWorkspaceAdmin: invitation.isWorkspaceAdmin,
          invitationId: invitation.id,
        },
        now,
      );
      invitation.status = 'accepted';
      invitation.respondedAt = now;
      await invitations.save(invitation);
      const persistedAssignment = await this.loadAssignment(
        manager.getRepository(ContractRoleAssignment),
        assignment.id,
        party.id,
        invitation.companyId,
      );
      return {
        status: 'accepted' as const,
        assignment:
          ContractRoleAssignmentResponseDto.fromEntity(persistedAssignment),
      };
    });

    if (result.status === 'expired') {
      throw new ConflictException('This invitation has expired.');
    }
    return result;
  }

  private async resolveAccess(
    userId: string,
    companyId: string,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ) {
    const scope = { companyId };
    const contract = await this.dataSource.getRepository(Contract).findOne({
      where: { id: contractId, deletedAt: IsNull() },
      select: { id: true },
    });
    if (!contract) {
      throw new NotFoundException('Contract was not found.');
    }
    await this.assertWorkspaceEnabled(
      this.dataSource.manager,
      contractId,
      workspace,
    );
    const membership = await this.companyUsers.findActiveMember(userId, scope);
    if (!membership) {
      throw new ForbiddenException('Active company membership is required.');
    }
    const party = await this.parties.findOne({
      where: { contractId, companyId },
    });
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    if (
      membership.companyRole !== ECompanyRole.COMPANY_ADMIN &&
      !(await this.assignments.hasWorkspaceAdmin(
        membership.id,
        party.id,
        WORKSPACE_ROLES[workspace],
        scope,
      ))
    ) {
      throw new ForbiddenException(
        'Workspace administrator access is required to manage contract roles.',
      );
    }
    return { party };
  }

  private async findPartyForUpdate(
    repository: Repository<ContractParty>,
    contractId: string,
    companyId: string,
  ): Promise<ContractParty> {
    const contract = await repository.manager
      .getRepository(Contract)
      .findOne({
        where: { id: contractId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
        select: { id: true },
      });
    if (!contract) {
      throw new NotFoundException('Contract was not found.');
    }
    const party = await repository.findOne({
      where: { contractId, companyId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!party) {
      throw new NotFoundException('Contract was not found.');
    }
    return party;
  }

  private async assertWorkspaceEnabled(
    manager: EntityManager,
    contractId: string,
    workspace: AssignableContractWorkspace,
  ): Promise<void> {
    const workspaceRecord = await manager
      .getRepository(ContractWorkspaceEntity)
      .findOne({
        where: { contractId, workspace },
        select: { contractId: true },
      });
    if (!workspaceRecord) {
      throw new NotFoundException('Contract workspace was not found.');
    }
  }

  private async requireManagementActor(
    repository: Repository<CompanyUser>,
    actorUserId: string,
    companyId: string,
    contractPartyId: string,
    workspace: AssignableContractWorkspace | undefined,
    manager: EntityManager,
    targetCompanyUserId?: string,
  ): Promise<{ actor: CompanyUser; isCompanyAdmin: boolean }> {
    const actorMembership = await repository.findOne({
      where: {
        userId: actorUserId,
        companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
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
    const locked = new Map<string, CompanyUser>();
    for (const id of memberIds) {
      const member = await repository.findOne({
        where: {
          id,
          companyId,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });
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
      (await this.assignments.hasWorkspaceAdmin(
        actor.id,
        contractPartyId,
        WORKSPACE_ROLES[workspace],
        { companyId },
        manager,
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

  private async writeActivity(
    manager: EntityManager,
    contractId: string,
    companyId: string,
    actorCompanyUserId: string,
    assignment: ContractRoleAssignment,
    action: string,
    workspace: AssignableContractWorkspace,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    occurredAt: Date,
  ): Promise<void> {
    const repository = manager.getRepository(ActivityLog);
    const record = repository.create({
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
    await repository.save(record);
  }

  private async writeInvitationActivity(
    manager: EntityManager,
    contractId: string,
    companyId: string,
    actorCompanyUserId: string,
    invitation: ContractRoleInvitation,
    action: string,
    occurredAt: Date,
  ): Promise<void> {
    const repository = manager.getRepository(ActivityLog);
    await repository.save(
      repository.create({
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
      }),
    );
  }

  private async loadAssignment(
    repository: Repository<ContractRoleAssignment>,
    id: string,
    contractPartyId: string,
    companyId: string,
  ): Promise<ContractRoleAssignment> {
    const assignment = await repository.findOne({
      where: { id, contractPartyId, companyId },
      relations: { companyUser: { user: true } },
    });
    if (!assignment) {
      throw new NotFoundException('Contract role assignment was not found.');
    }
    return assignment;
  }
}
