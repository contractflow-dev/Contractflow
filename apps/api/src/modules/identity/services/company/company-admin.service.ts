import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  type CompanyInvitationDecision,
  ECompanyRole,
  ECompanyStatus,
  ECompanyUserStatus,
  EInvitationStatus,
  type ICompanyInvitationResponseResult,
  type ICompanyTeamSummaryResponse,
  type IPaginatedResponse,
} from '@contractflow/contracts-schema';
import { toPaginatedResponse } from '../../../../common/application/pagination';
import type { IPageQuery } from '../../../../common/application/pagination.interface';
import type { ICompanyScope } from '../../../../common/database/repositories/company-scope.interface';
import type { Company } from '../../entities/company.entity';
import type { CompanyInvitation } from '../../entities/company-invitation.entity';
import type { CompanyUser } from '../../entities/company-user.entity';
import {
  COMPANY_ADMIN_READ_REPOSITORY,
  COMPANY_ADMIN_UNIT_OF_WORK,
  type ICompanyAdminReadRepository,
  type ICompanyAdminTransactionContext,
  type ICompanyAdminUnitOfWork,
  type IInvitationPerson,
} from '../../interface/company-admin-persistence.interface';
import { CompanyScopeService } from './company-scope.service';
import { CompanyVerificationService } from './company-verification.service';
import { MailService } from '../../../mail/mail.service';
import { CompanyResponseDto } from '../../dto/company/responses/company-response.dto';
import {
  CompanyMemberResponseDto,
  type ICompanyMemberResponseDto,
} from '../../dto/company/responses/company-member-response.dto';
import {
  CompanyInvitationResponseDto,
  type ICompanyInvitationResponseDto,
} from '../../dto/company/responses/company-invitation-response.dto';
import type {
  CompanyInvitationPublicResponseDto,
  IMyCompanyInvitationResponseDto,
} from '../../dto/company/responses/company-invitation-public-response.dto';
import type { InviteCompanyMemberRequestDto } from '../../dto/company/requests/invite-company-member-request.dto';
import type { ListCompanyMembersRequestDto } from '../../dto/company/requests/list-company-members-request.dto';
import type { UpdateCompanyMemberRoleRequestDto } from '../../dto/company/requests/update-company-member-role-request.dto';
import type { UpdateCompanyProfileRequestDto } from '../../dto/company/requests/update-company-profile-request.dto';
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const COMPANY_ROLES: ReadonlySet<string> = new Set(Object.values(ECompanyRole));

function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** The inviter to tell about an answer, sent once the answer is committed. */
interface IInvitationResponseNotice {
  inviter: IInvitationPerson;
  companyName: string;
  inviteeEmail: string;
  companyRole: ECompanyRole;
  decision: 'accepted' | 'declined';
}

interface IInvitationAnswer {
  result: ICompanyInvitationResponseResult;
  notice: IInvitationResponseNotice | null;
}

/** Who is answering an invitation, from the authenticated session. */
interface IInvitee {
  userId: string;
  email: string;
}

@Injectable()
export class CompanyAdminService {
  private readonly logger = new Logger(CompanyAdminService.name);

  constructor(
    private readonly companyScope: CompanyScopeService,
    private readonly mail: MailService,
    @Inject(COMPANY_ADMIN_READ_REPOSITORY)
    private readonly reads: ICompanyAdminReadRepository,
    @Inject(COMPANY_ADMIN_UNIT_OF_WORK)
    private readonly unitOfWork: ICompanyAdminUnitOfWork,
    private readonly companyVerification: CompanyVerificationService,
  ) {}

  async listMembers(
    userId: string,
    companyId: string,
    query: ListCompanyMembersRequestDto,
  ): Promise<IPaginatedResponse<ICompanyMemberResponseDto>> {
    const scope = await this.requireCompanyAdmin(userId, companyId);
    const { items, total } = await this.reads.listMembers(scope, {
      status: query.status,
      companyRole: query.companyRole,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      limit: query.limit,
    });

    return toPaginatedResponse(
      { items: items.map(CompanyMemberResponseDto.fromEntity), total },
      query,
    );
  }

  /** Membership and invitation counts for the Team page. */
  async getTeamSummary(
    userId: string,
    companyId: string,
  ): Promise<ICompanyTeamSummaryResponse> {
    const scope = await this.requireCompanyAdmin(userId, companyId);
    const [members, pendingInvitationCount] = await Promise.all([
      this.reads.countMembers(scope),
      this.reads.countPendingInvitations(scope, new Date()),
    ]);
    return {
      memberCount: members.total,
      activeMemberCount: members.active,
      companyAdminCount: members.activeAdmins,
      pendingInvitationCount,
    };
  }

  async updateMemberRole(
    userId: string,
    companyId: string,
    membershipId: string,
    dto: UpdateCompanyMemberRoleRequestDto,
  ): Promise<ICompanyMemberResponseDto> {
    return this.unitOfWork.execute(async (context) => {
      const { scope } = await this.lockCompanyAdmin(context, userId, companyId);
      const target = await context.members.lockActiveById(scope, membershipId);

      if (!target) {
        throw new NotFoundException('Active company member was not found.');
      }

      if (
        target.companyRole === ECompanyRole.COMPANY_ADMIN &&
        (await context.members.countActiveAdmins(scope)) <= 1
      ) {
        throw new ConflictException(
          'Assign another Company Administrator before changing this role.',
        );
      }

      target.companyRole = dto.companyRole;
      const saved = await context.members.save(target);
      const user = await context.users.findById(saved.userId);
      if (!user) {
        throw new NotFoundException('Company member user was not found.');
      }
      return CompanyMemberResponseDto.fromEntity({ ...saved, user });
    });
  }

  async removeMember(
    userId: string,
    companyId: string,
    membershipId: string,
  ): Promise<void> {
    await this.unitOfWork.execute(async (context) => {
      const { scope } = await this.lockCompanyAdmin(context, userId, companyId);
      const target = await context.members.lockActiveById(scope, membershipId);

      if (!target) {
        throw new NotFoundException('Active company member was not found.');
      }
      if (
        target.companyRole === ECompanyRole.COMPANY_ADMIN &&
        (await context.members.countActiveAdmins(scope)) <= 1
      ) {
        throw new ConflictException(
          'Assign another Company Administrator before removing this member.',
        );
      }

      target.status = ECompanyUserStatus.INACTIVE;
      target.leftAt = new Date();
      await context.members.save(target);
    });
  }

  async listInvitations(
    userId: string,
    companyId: string,
    query: IPageQuery,
  ): Promise<IPaginatedResponse<ICompanyInvitationResponseDto>> {
    const scope = await this.requireCompanyAdmin(userId, companyId);
    const result = await this.reads.listInvitations(scope, query);

    return toPaginatedResponse(
      {
        items: result.items.map((invitation) =>
          CompanyInvitationResponseDto.fromEntity(invitation),
        ),
        total: result.total,
      },
      query,
    );
  }

  // NOTE: the email is sent before the unit of work commits. If the commit
  // fails after delivery, the recipient holds a token for an invitation that
  // was rolled back. Preserved deliberately; an outbox would remove the risk.
  async inviteMember(
    userId: string,
    companyId: string,
    dto: InviteCompanyMemberRequestDto,
  ): Promise<ICompanyInvitationResponseDto> {
    return this.unitOfWork.execute(async (context) => {
      const { company, membership, scope } = await this.lockCompanyAdmin(
        context,
        userId,
        companyId,
      );
      const now = new Date();

      const invitedUser = await context.users.findIdByEmail(dto.email);
      if (invitedUser) {
        const existingMembership = await context.members.findActiveByUser(
          scope,
          invitedUser.id,
        );
        if (existingMembership) {
          throw new ConflictException(
            'This user is already an active member of the company.',
          );
        }
      }

      const duplicate = await context.invitations.findActivePendingByEmail(
        scope,
        dto.email,
        now,
      );
      if (duplicate) {
        throw new ConflictException(
          'An active invitation already exists for this email address.',
        );
      }

      await context.invitations.expirePendingByEmail(scope, dto.email, now);

      const token = randomBytes(32).toString('base64url');
      const inviter = await context.users.findById(userId);
      const saved = await context.invitations.create({
        companyId: scope.companyId,
        invitedByCompanyUserId: membership.id,
        email: dto.email,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        companyRole: dto.companyRole,
        tokenHash: hashToken(token),
        status: EInvitationStatus.PENDING,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        acceptedAt: null,
        revokedAt: null,
      });

      await context.auditLogs.append({
        companyId: scope.companyId,
        actorCompanyUserId: membership.id,
        actorUserId: userId,
        action: 'company.invitation_created',
        entityType: 'company_invitation',
        entityId: saved.id,
        summary: `Invited ${dto.email} as ${dto.companyRole}.`,
        changes: { email: dto.email, companyRole: dto.companyRole },
        occurredAt: now,
      });

      await this.mail.sendCompanyInvitationEmail(
        dto.email,
        company.name,
        dto.companyRole,
        token,
        inviter ? personName(inviter) : null,
      );

      return CompanyInvitationResponseDto.fromEntity(saved, now);
    });
  }

  async revokeInvitation(
    userId: string,
    companyId: string,
    invitationId: string,
  ): Promise<ICompanyInvitationResponseDto> {
    return this.unitOfWork.execute(async (context) => {
      const { membership, scope } = await this.lockCompanyAdmin(
        context,
        userId,
        companyId,
      );
      const invitation = await context.invitations.lockById(
        scope,
        invitationId,
      );
      if (!invitation) {
        throw new NotFoundException('Company invitation was not found.');
      }
      if (
        invitation.status !== EInvitationStatus.PENDING ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date()
      ) {
        throw new ConflictException(
          'Only an active pending invitation can be revoked.',
        );
      }

      const revokedAt = new Date();
      const revoked = await context.invitations.revokePending(
        scope,
        invitationId,
        revokedAt,
      );
      if (!revoked) {
        throw new ConflictException(
          'This invitation is no longer pending and cannot be revoked.',
        );
      }
      await context.auditLogs.append({
        companyId: scope.companyId,
        actorCompanyUserId: membership.id,
        actorUserId: userId,
        action: 'company.invitation_revoked',
        entityType: 'company_invitation',
        entityId: invitation.id,
        summary: `Revoked the invitation to ${invitation.email}.`,
        changes: { status: EInvitationStatus.REVOKED },
        occurredAt: revokedAt,
      });
      return CompanyInvitationResponseDto.fromEntity({
        ...invitation,
        status: EInvitationStatus.REVOKED,
        revokedAt,
      });
    });
  }

  /**
   * Gives a new token and expiry to a pending or expired invitation and sends
   * it again. The old link stops working: only the new token's hash is kept.
   */
  async resendInvitation(
    userId: string,
    companyId: string,
    invitationId: string,
  ): Promise<ICompanyInvitationResponseDto> {
    return this.unitOfWork.execute(async (context) => {
      const { company, membership, scope } = await this.lockCompanyAdmin(
        context,
        userId,
        companyId,
      );
      const invitation = await context.invitations.lockById(
        scope,
        invitationId,
      );
      if (!invitation) {
        throw new NotFoundException('Company invitation was not found.');
      }
      const resendable =
        !invitation.revokedAt &&
        (invitation.status === EInvitationStatus.PENDING ||
          invitation.status === EInvitationStatus.EXPIRED);
      if (!resendable) {
        throw new ConflictException(
          'Only a pending or expired invitation can be sent again.',
        );
      }

      const now = new Date();
      if (
        await context.invitations.findOtherActivePendingByEmail(
          scope,
          invitation.email,
          invitation.id,
          now,
        )
      ) {
        throw new ConflictException(
          'Another active invitation already exists for this email address.',
        );
      }
      const invitedUser = await context.users.findIdByEmail(invitation.email);
      if (
        invitedUser &&
        (await context.members.findActiveByUser(scope, invitedUser.id))
      ) {
        throw new ConflictException(
          'This user is already an active member of the company.',
        );
      }

      const token = randomBytes(32).toString('base64url');
      invitation.tokenHash = hashToken(token);
      invitation.status = EInvitationStatus.PENDING;
      invitation.expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
      const saved = await context.invitations.save(invitation);
      await context.auditLogs.append({
        companyId: scope.companyId,
        actorCompanyUserId: membership.id,
        actorUserId: userId,
        action: 'company.invitation_resent',
        entityType: 'company_invitation',
        entityId: invitation.id,
        summary: `Sent the invitation to ${invitation.email} again.`,
        changes: { expiresAt: saved.expiresAt.toISOString() },
        occurredAt: now,
      });

      const inviter = await context.users.findById(userId);
      await this.mail.sendCompanyInvitationEmail(
        invitation.email,
        company.name,
        invitation.companyRole,
        token,
        inviter ? personName(inviter) : null,
      );
      return CompanyInvitationResponseDto.fromEntity(saved, now);
    });
  }

  /**
   * What an invitation link shows. A pending invitation shows its details;
   * any other known invitation reports only its status.
   */
  async getInvitationByToken(
    token: string,
  ): Promise<CompanyInvitationPublicResponseDto> {
    const invitation = await this.reads.findInvitationByTokenHash(
      hashToken(token),
    );
    if (!invitation) {
      throw new NotFoundException('Invitation was not found.');
    }
    if (invitation.revokedAt) {
      return { status: EInvitationStatus.REVOKED };
    }
    if (invitation.status !== EInvitationStatus.PENDING) {
      return { status: invitation.status };
    }
    if (invitation.expiresAt <= new Date()) {
      await this.reads.expireInvitation(
        { companyId: invitation.companyId },
        invitation.id,
      );
      return { status: EInvitationStatus.EXPIRED };
    }

    const company = await this.reads.findCompanyName(invitation.companyId);
    if (!company) {
      throw new NotFoundException('Invitation was not found.');
    }
    if (company.status !== ECompanyStatus.ACTIVE) {
      throw new ConflictException(
        'This company is not accepting new members right now.',
      );
    }
    return {
      status: EInvitationStatus.PENDING,
      companyName: company.name,
      inviterName: await this.reads.findMemberName(
        invitation.invitedByCompanyUserId,
      ),
      email: invitation.email,
      companyRole: invitation.companyRole,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * The signed-in user's pending company invitations, found by their verified
   * email address. An unverified address has none: it isn't proven theirs.
   */
  async listMyInvitations(
    userEmail: string,
    isEmailVerified: boolean,
  ): Promise<IMyCompanyInvitationResponseDto[]> {
    if (!isEmailVerified) return [];
    const rows = await this.reads.listPendingInvitationsForEmail(
      userEmail,
      new Date(),
    );
    return rows.map(({ invitation, companyName, inviterName }) => ({
      id: invitation.id,
      companyName,
      inviterName,
      email: invitation.email,
      companyRole: invitation.companyRole,
      expiresAt: invitation.expiresAt,
    }));
  }

  /** Answers an invitation from its emailed link. */
  async respondToInvitation(
    userId: string,
    userEmail: string,
    isEmailVerified: boolean,
    token: string,
    decision: CompanyInvitationDecision,
  ): Promise<ICompanyInvitationResponseResult> {
    this.requireVerifiedEmail(isEmailVerified);
    const invitee: IInvitee = { userId, email: userEmail };
    return this.answer(invitee, decision, async (context) => {
      const invitation = await context.invitations.lockByTokenHash(
        hashToken(token),
      );
      if (!invitation) {
        throw new NotFoundException('Invitation was not found.');
      }
      if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw new ForbiddenException(
          'Sign in with the email address that received this invitation.',
        );
      }
      return invitation;
    });
  }

  /**
   * Answers one of the signed-in user's own invitations by ID. Only an
   * invitation addressed to the user's email is found, so another person's
   * invitation ID is simply "not found".
   */
  async respondToMyInvitation(
    userId: string,
    userEmail: string,
    isEmailVerified: boolean,
    invitationId: string,
    decision: CompanyInvitationDecision,
  ): Promise<ICompanyInvitationResponseResult> {
    this.requireVerifiedEmail(isEmailVerified);
    const invitee: IInvitee = { userId, email: userEmail };
    return this.answer(invitee, decision, async (context) => {
      const invitation = await context.invitations.lockByIdForEmail(
        invitationId,
        userEmail,
      );
      if (!invitation) {
        throw new NotFoundException('Invitation was not found.');
      }
      return invitation;
    });
  }

  private requireVerifiedEmail(isEmailVerified: boolean): void {
    if (!isEmailVerified) {
      throw new ForbiddenException(
        'Verify your email address before responding to an invitation.',
      );
    }
  }

  /**
   * Accepts or declines a locked invitation in one transaction: the status
   * change, any membership and the audit entry commit together. The inviter
   * is told only after the commit, and a failed notice changes nothing.
   */
  private async answer(
    invitee: IInvitee,
    decision: CompanyInvitationDecision,
    lockInvitation: (
      context: ICompanyAdminTransactionContext,
    ) => Promise<CompanyInvitation>,
  ): Promise<ICompanyInvitationResponseResult> {
    const outcome = await this.unitOfWork.execute(async (context) =>
      this.answerLocked(
        context,
        await lockInvitation(context),
        invitee,
        decision,
      ),
    );

    if (outcome.notice) await this.notifyInviter(outcome.notice);
    if (outcome.result.status === EInvitationStatus.EXPIRED) {
      throw new ConflictException('This invitation has expired.');
    }
    return outcome.result;
  }

  private async answerLocked(
    context: ICompanyAdminTransactionContext,
    invitation: CompanyInvitation,
    invitee: IInvitee,
    decision: CompanyInvitationDecision,
  ): Promise<IInvitationAnswer> {
    if (
      invitation.revokedAt ||
      invitation.status === EInvitationStatus.REVOKED
    ) {
      throw new ConflictException('This invitation was revoked.');
    }
    if (invitation.status === EInvitationStatus.EXPIRED) {
      throw new ConflictException('This invitation has expired.');
    }
    if (invitation.status !== EInvitationStatus.PENDING) {
      throw new ConflictException('This invitation has already been used.');
    }
    const now = new Date();
    if (invitation.expiresAt <= now) {
      // Committed, so the invitation reads as expired from now on.
      invitation.status = EInvitationStatus.EXPIRED;
      await context.invitations.save(invitation);
      return { result: { status: EInvitationStatus.EXPIRED }, notice: null };
    }

    // The company and role come from the token-matched row, never from the
    // request. Locking the company keeps it from being deactivated meanwhile.
    const scope: ICompanyScope = Object.freeze({
      companyId: invitation.companyId,
    });
    const company = await context.companies.lockById(scope);
    if (!company || company.status !== ECompanyStatus.ACTIVE) {
      throw new ConflictException(
        'This company is not accepting new members right now.',
      );
    }
    if (!COMPANY_ROLES.has(invitation.companyRole)) {
      throw new ConflictException(
        'This invitation has an invalid role. Ask the company administrator for a new invitation.',
      );
    }

    const membershipRole = invitation.companyRole;
    const notice = async (
      answered: 'accepted' | 'declined',
    ): Promise<IInvitationResponseNotice | null> => {
      const inviter = await context.users.findActiveMemberPerson(
        scope,
        invitation.invitedByCompanyUserId,
      );
      return inviter
        ? {
            inviter,
            companyName: company.name,
            inviteeEmail: invitation.email,
            companyRole: membershipRole,
            decision: answered,
          }
        : null;
    };

    if (decision === 'decline') {
      invitation.status = EInvitationStatus.DECLINED;
      await context.invitations.save(invitation);
      await context.auditLogs.append({
        companyId: scope.companyId,
        actorCompanyUserId: null,
        actorUserId: invitee.userId,
        action: 'company.invitation_declined',
        entityType: 'company_invitation',
        entityId: invitation.id,
        summary: `${invitation.email} declined the invitation.`,
        changes: { status: EInvitationStatus.DECLINED },
        occurredAt: now,
      });
      return {
        result: { status: EInvitationStatus.DECLINED },
        notice: await notice('declined'),
      };
    }

    const existingMembership = await context.members.lockAnyByUser(
      scope,
      invitee.userId,
    );
    if (
      existingMembership?.status === ECompanyUserStatus.ACTIVE &&
      !existingMembership.leftAt
    ) {
      // An existing member keeps their current role: an invitation never
      // changes it, so it can't raise or lower privileges.
      throw new ConflictException(
        'You are already an active member of this company.',
      );
    }

    // The invited company role becomes the membership role. Nothing here
    // grants contract or workspace access: that needs a contract role.
    let membership: CompanyUser;
    if (existingMembership) {
      existingMembership.companyRole = membershipRole;
      // A returning member keeps the job title they had.
      existingMembership.jobTitle ||= invitation.companyRole;
      existingMembership.status = ECompanyUserStatus.ACTIVE;
      existingMembership.joinedAt = now;
      existingMembership.leftAt = null;
      membership = await context.members.save(existingMembership);
    } else {
      membership = await context.members.create({
        companyId: invitation.companyId,
        userId: invitee.userId,
        companyRole: membershipRole,
        jobTitle: invitation.companyRole,
        status: ECompanyUserStatus.ACTIVE,
        joinedAt: now,
        leftAt: null,
      });
    }

    invitation.status = EInvitationStatus.ACCEPTED;
    invitation.acceptedAt = now;
    await context.invitations.save(invitation);
    await context.auditLogs.append({
      companyId: scope.companyId,
      actorCompanyUserId: membership.id,
      actorUserId: invitee.userId,
      action: 'company.invitation_accepted',
      entityType: 'company_invitation',
      entityId: invitation.id,
      summary: `${invitation.email} accepted the invitation and joined as ${membershipRole}.`,
      changes: {
        status: EInvitationStatus.ACCEPTED,
        companyUserId: membership.id,
        companyRole: membershipRole,
        rejoined: Boolean(existingMembership),
      },
      occurredAt: now,
    });
    return {
      result: {
        status: EInvitationStatus.ACCEPTED,
        companyId: invitation.companyId,
      },
      notice: await notice('accepted'),
    };
  }

  private async notifyInviter(
    notice: IInvitationResponseNotice,
  ): Promise<void> {
    try {
      await this.mail.sendCompanyInvitationResponseEmail(
        notice.inviter.email,
        notice.companyName,
        notice.inviteeEmail,
        notice.companyRole,
        notice.decision,
      );
    } catch (error) {
      // The answer is already committed; a missed notice must not undo it.
      this.logger.warn(
        `Could not notify the inviter that an invitation was ${notice.decision}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async updateCompanyProfile(
    userId: string,
    companyId: string,
    dto: UpdateCompanyProfileRequestDto,
  ) {
    if (!Object.keys(dto).length) {
      throw new BadRequestException('At least one company field is required.');
    }

    const { response, emailChanged } = await this.unitOfWork.execute(
      async (context) => {
        const { scope } = await this.lockCompanyAdmin(
          context,
          userId,
          companyId,
        );
        const company = await context.companies.lockById(scope);
        if (!company) {
          throw new NotFoundException('Company was not found.');
        }
        const emailChanged =
          dto.email !== undefined &&
          dto.email.toLowerCase() !== company.email.toLowerCase();
        Object.assign(company, dto);
        // Verification proves control of one inbox; a new address must be
        // verified again before the company can receive contract invitations.
        if (emailChanged) company.verifiedAt = null;
        const saved = await context.companies.save(company);
        return { response: CompanyResponseDto.fromEntity(saved), emailChanged };
      },
    );
    if (emailChanged) {
      await this.companyVerification.sendAfterEmailChange(companyId);
    }
    return response;
  }

  private async requireCompanyAdmin(
    userId: string,
    companyId: string,
  ): Promise<ICompanyScope> {
    const scope = await this.companyScope.forUser(userId, companyId);
    const role = await this.reads.findActiveRole(scope, userId);
    if (role !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only company administrators can manage this company.',
      );
    }
    return scope;
  }

  private async lockCompanyAdmin(
    context: ICompanyAdminTransactionContext,
    userId: string,
    companyId: string,
  ): Promise<{
    company: Company;
    membership: CompanyUser;
    scope: ICompanyScope;
  }> {
    const normalizedCompanyId = companyId?.trim();
    const scope: ICompanyScope = Object.freeze({
      companyId: normalizedCompanyId,
    });
    const company = normalizedCompanyId
      ? await context.companies.lockById(scope)
      : null;
    if (!company) {
      throw new ForbiddenException('Active company membership is required.');
    }

    const membership = await context.members.lockActiveByUser(scope, userId);
    if (!membership || membership.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only company administrators can manage this company.',
      );
    }

    return { company, membership, scope };
  }
}
