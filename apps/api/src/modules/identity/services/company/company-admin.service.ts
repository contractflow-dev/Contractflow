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
  ECompanyUserStatus,
  EInvitationRole,
  EInvitationStatus,
  type IPaginatedResponse,
} from '@contractflow/contracts-schema';
import { toPaginatedResponse } from '../../../../common/application/pagination';
import type { IPageQuery } from '../../../../common/application/pagination.interface';
import type { ICompanyScope } from '../../../../common/database/repositories/company-scope.interface';
import type { Company } from '../../entities/company.entity';
import type { CompanyUser } from '../../entities/company-user.entity';
import {
  COMPANY_ADMIN_READ_REPOSITORY,
  COMPANY_ADMIN_UNIT_OF_WORK,
  type ICompanyAdminReadRepository,
  type ICompanyAdminTransactionContext,
  type ICompanyAdminUnitOfWork,
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
import type { CompanyInvitationPublicResponseDto } from '../../dto/company/responses/company-invitation-public-response.dto';
import type { InviteCompanyMemberRequestDto } from '../../dto/company/requests/invite-company-member-request.dto';
import type { ListCompanyMembersRequestDto } from '../../dto/company/requests/list-company-members-request.dto';
import type { UpdateCompanyMemberRoleRequestDto } from '../../dto/company/requests/update-company-member-role-request.dto';
import type { UpdateCompanyProfileRequestDto } from '../../dto/company/requests/update-company-profile-request.dto';
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function roleForMembership(role: EInvitationRole): ECompanyRole {
  const roleMap: Record<EInvitationRole, ECompanyRole> = {
    [EInvitationRole.CONTRACTOR_PROJECT_LEAD]:
      ECompanyRole.CONTRACTOR_PROJECT_LEAD,
    [EInvitationRole.CONTRACTOR_SITE_SUPERVISOR]:
      ECompanyRole.CONTRACTOR_SITE_SUPERVISOR,
    [EInvitationRole.CLIENT_PROJECT_MANAGER]:
      ECompanyRole.CLIENT_PROJECT_MANAGER,
    [EInvitationRole.CLIENT_SITE_ENGINEER]: ECompanyRole.CLIENT_SITE_ENGINEER,
    [EInvitationRole.HSE_OFFICER]: ECompanyRole.HSE_OFFICER,
    [EInvitationRole.HSE_MANAGER]: ECompanyRole.HSE_MANAGER,
    [EInvitationRole.FINANCE_OFFICER]: ECompanyRole.FINANCE_OFFICER,
    [EInvitationRole.FINANCE_DIRECTOR]: ECompanyRole.FINANCE_DIRECTOR,
  };
  return roleMap[role];
}

@Injectable()
export class CompanyAdminService {
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
      search: query.search,
      page: query.page,
      limit: query.limit,
    });

    return toPaginatedResponse(
      { items: items.map(CompanyMemberResponseDto.fromEntity), total },
      query,
    );
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
      const saved = await context.invitations.create({
        companyId: scope.companyId,
        invitedByCompanyUserId: membership.id,
        email: dto.email,
        firstName: null,
        lastName: null,
        companyRole: dto.companyRole,
        tokenHash: hashToken(token),
        status: EInvitationStatus.PENDING,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        acceptedAt: null,
        revokedAt: null,
      });

      await this.mail.sendCompanyInvitationEmail(
        dto.email,
        company.name,
        dto.companyRole,
        token,
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
      const { scope } = await this.lockCompanyAdmin(context, userId, companyId);
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
      return CompanyInvitationResponseDto.fromEntity({
        ...invitation,
        status: EInvitationStatus.REVOKED,
        revokedAt,
      });
    });
  }

  async getInvitationByToken(
    token: string,
  ): Promise<CompanyInvitationPublicResponseDto> {
    const invitation = await this.reads.findInvitationByTokenHash(
      hashToken(token),
    );
    if (!invitation) {
      throw new NotFoundException('Invitation was not found.');
    }
    if (
      invitation.status !== EInvitationStatus.PENDING ||
      invitation.revokedAt
    ) {
      throw new ConflictException('This invitation is no longer active.');
    }
    if (invitation.expiresAt <= new Date()) {
      await this.reads.expireInvitation(
        { companyId: invitation.companyId },
        invitation.id,
      );
      throw new ConflictException('This invitation has expired.');
    }

    const company = await this.reads.findCompanyName(invitation.companyId);
    if (!company) {
      throw new NotFoundException('Invitation company was not found.');
    }
    return {
      companyName: company.name,
      email: invitation.email,
      companyRole: invitation.companyRole,
      expiresAt: invitation.expiresAt,
    };
  }

  async respondToInvitation(
    userId: string,
    userEmail: string,
    isEmailVerified: boolean,
    token: string,
    decision: 'accept' | 'decline',
  ): Promise<{ status: EInvitationStatus }> {
    if (!isEmailVerified) {
      throw new ForbiddenException(
        'Verify your email address before responding to an invitation.',
      );
    }

    const outcome = await this.unitOfWork.execute(async (context) => {
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
      if (
        invitation.status !== EInvitationStatus.PENDING ||
        invitation.revokedAt
      ) {
        throw new ConflictException('This invitation has already been used.');
      }
      if (invitation.expiresAt <= new Date()) {
        invitation.status = EInvitationStatus.EXPIRED;
        await context.invitations.save(invitation);
        return { status: EInvitationStatus.EXPIRED as const };
      }

      if (decision === 'decline') {
        invitation.status = EInvitationStatus.DECLINED;
        await context.invitations.save(invitation);
        return { status: EInvitationStatus.DECLINED as const };
      }

      // The company comes from the token-matched row, never from the request.
      const scope: ICompanyScope = Object.freeze({
        companyId: invitation.companyId,
      });
      const existingMembership = await context.members.lockAnyByUser(
        scope,
        userId,
      );
      if (
        existingMembership?.status === ECompanyUserStatus.ACTIVE &&
        !existingMembership.leftAt
      ) {
        throw new ConflictException(
          'You are already an active member of this company.',
        );
      }

      const membershipRole = roleForMembership(invitation.companyRole);
      if (existingMembership) {
        existingMembership.companyRole = membershipRole;
        existingMembership.jobTitle = invitation.companyRole;
        existingMembership.status = ECompanyUserStatus.ACTIVE;
        existingMembership.joinedAt = new Date();
        existingMembership.leftAt = null;
        await context.members.save(existingMembership);
      } else {
        await context.members.create({
          companyId: invitation.companyId,
          userId,
          companyRole: membershipRole,
          jobTitle: invitation.companyRole,
          status: ECompanyUserStatus.ACTIVE,
          joinedAt: new Date(),
          leftAt: null,
        });
      }

      invitation.status = EInvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      await context.invitations.save(invitation);
      return { status: EInvitationStatus.ACCEPTED as const };
    });

    if (outcome.status === EInvitationStatus.EXPIRED) {
      throw new ConflictException('This invitation has expired.');
    }
    return outcome;
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
