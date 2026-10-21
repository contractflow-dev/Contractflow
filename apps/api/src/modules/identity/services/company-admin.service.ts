import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import {
  ECompanyRole,
  ECompanyUserStatus,
  EInvitationRole,
  EInvitationStatus,
} from '@contractflow/contracts-schema';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { Company } from '../entities/company.entity';
import { CompanyInvitation } from '../entities/company-invitation.entity';
import { CompanyUser } from '../entities/company-user.entity';
import { AppUser } from '../entities/app-user.entity';
import { CompanyInvitationRepository } from '../repositories/company-invitation.repository';
import { CompanyScopeService } from './company-scope.service';
import { MailService } from '../../mail/mail.service';
import { CompanyResponseDto } from '../dto/company/responses/company-response.dto';
import {
  CompanyMemberResponseDto,
  type ICompanyMemberResponseDto,
} from '../dto/company/responses/company-member-response.dto';
import {
  CompanyInvitationResponseDto,
  type ICompanyInvitationResponseDto,
} from '../dto/company/responses/company-invitation-response.dto';
import type { CompanyInvitationPublicResponseDto } from '../dto/company/responses/company-invitation-public-response.dto';
import type { InviteCompanyMemberRequestDto } from '../dto/company/requests/invite-company-member-request.dto';
import type { ListCompanyMembersRequestDto } from '../dto/company/requests/list-company-members-request.dto';
import type { UpdateCompanyMemberRoleRequestDto } from '../dto/company/requests/update-company-member-role-request.dto';
import type { UpdateCompanyProfileRequestDto } from '../dto/company/requests/update-company-profile-request.dto';

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
    private readonly dataSource: DataSource,
    private readonly companyScope: CompanyScopeService,
    private readonly invitations: CompanyInvitationRepository,
    private readonly mail: MailService,
    @InjectRepository(CompanyUser)
    private readonly companyUsers: Repository<CompanyUser>,
  ) {}

  async listMembers(
    userId: string,
    companyId: string,
    query: ListCompanyMembersRequestDto,
  ): Promise<{
    items: ICompanyMemberResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const scope = await this.requireCompanyAdmin(userId, companyId);
    const builder = this.companyUsers
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .where('membership.companyId = :companyId', {
        companyId: scope.companyId,
      });

    if (query.status) {
      builder.andWhere('membership.status = :status', {
        status: query.status,
      });
    }

    if (query.search) {
      const search = query.search.replace(/[\\%_]/g, '\\$&');
      builder.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [members, total] = await builder
      .orderBy('membership.joinedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: members.map(CompanyMemberResponseDto.fromEntity),
      total,
      page,
      limit,
    };
  }

  async updateMemberRole(
    userId: string,
    companyId: string,
    membershipId: string,
    dto: UpdateCompanyMemberRoleRequestDto,
  ): Promise<ICompanyMemberResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const { scope } = await this.lockCompanyAdmin(manager, userId, companyId);
      const members = manager.getRepository(CompanyUser);
      const target = await members.findOne({
        where: {
          id: membershipId,
          companyId: scope.companyId,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!target) {
        throw new NotFoundException('Active company member was not found.');
      }

      if (
        target.companyRole === ECompanyRole.COMPANY_ADMIN &&
        (await this.countActiveAdmins(members, scope.companyId)) <= 1
      ) {
        throw new ConflictException(
          'Assign another Company Administrator before changing this role.',
        );
      }

      target.companyRole = dto.companyRole;
      const saved = await members.save(target);
      const user = await manager.getRepository(AppUser).findOneBy({
        id: saved.userId,
      });
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
    await this.dataSource.transaction(async (manager) => {
      const { scope } = await this.lockCompanyAdmin(manager, userId, companyId);
      const members = manager.getRepository(CompanyUser);
      const target = await members.findOne({
        where: {
          id: membershipId,
          companyId: scope.companyId,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!target) {
        throw new NotFoundException('Active company member was not found.');
      }
      if (
        target.companyRole === ECompanyRole.COMPANY_ADMIN &&
        (await this.countActiveAdmins(members, scope.companyId)) <= 1
      ) {
        throw new ConflictException(
          'Assign another Company Administrator before removing this member.',
        );
      }

      target.status = ECompanyUserStatus.INACTIVE;
      target.leftAt = new Date();
      await members.save(target);
    });
  }

  async listInvitations(
    userId: string,
    companyId: string,
    page = 1,
    limit = 50,
  ): Promise<{
    items: ICompanyInvitationResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const scope = await this.requireCompanyAdmin(userId, companyId);
    const result = await this.invitations.findPage(scope, {
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: result.items.map((invitation) =>
        CompanyInvitationResponseDto.fromEntity(invitation),
      ),
      total: result.total,
      page,
      limit,
    };
  }

  async inviteMember(
    userId: string,
    companyId: string,
    dto: InviteCompanyMemberRequestDto,
  ): Promise<ICompanyInvitationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const { company, membership, scope } = await this.lockCompanyAdmin(
        manager,
        userId,
        companyId,
      );
      const invitationRepository = manager.getRepository(CompanyInvitation);
      const userRepository = manager.getRepository(AppUser);
      const memberRepository = manager.getRepository(CompanyUser);
      const now = new Date();

      const invitedUser = await userRepository.findOne({
        where: { email: dto.email },
        select: { id: true, email: true },
      });
      if (invitedUser) {
        const existingMembership = await memberRepository.findOne({
          where: {
            companyId: scope.companyId,
            userId: invitedUser.id,
            status: ECompanyUserStatus.ACTIVE,
            leftAt: IsNull(),
          },
        });
        if (existingMembership) {
          throw new ConflictException(
            'This user is already an active member of the company.',
          );
        }
      }

      const duplicate = await invitationRepository
        .createQueryBuilder('invitation')
        .where('invitation.companyId = :companyId', {
          companyId: scope.companyId,
        })
        .andWhere('invitation.email = :email', { email: dto.email })
        .andWhere('invitation.status = :status', {
          status: EInvitationStatus.PENDING,
        })
        .andWhere('invitation.expiresAt > :now', { now })
        .getOne();
      if (duplicate) {
        throw new ConflictException(
          'An active invitation already exists for this email address.',
        );
      }

      await invitationRepository.update(
        {
          companyId: scope.companyId,
          email: dto.email,
          status: EInvitationStatus.PENDING,
          expiresAt: LessThanOrEqual(now),
        },
        { status: EInvitationStatus.EXPIRED },
      );

      const token = randomBytes(32).toString('base64url');
      const invitation = invitationRepository.create({
        companyId: scope.companyId,
        invitedByCompanyUserId: membership.id,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyRole: dto.companyRole,
        tokenHash: hashToken(token),
        status: EInvitationStatus.PENDING,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        acceptedAt: null,
        revokedAt: null,
      });
      const saved = await invitationRepository.save(invitation);

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
    return this.dataSource.transaction(async (manager) => {
      const { scope } = await this.lockCompanyAdmin(manager, userId, companyId);
      const invitations = manager.getRepository(CompanyInvitation);
      const invitation = await invitations.findOne({
        where: {
          id: invitationId,
          companyId: scope.companyId,
        },
        lock: { mode: 'pessimistic_write' },
      });
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
      const result = await invitations.update(
        {
          id: invitationId,
          companyId: scope.companyId,
          status: EInvitationStatus.PENDING,
          revokedAt: IsNull(),
        },
        {
          status: EInvitationStatus.REVOKED,
          revokedAt,
        },
      );
      if (result.affected !== 1) {
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
    const invitation = await this.invitations.findByTokenHashUnscoped(
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
      await this.invitations.update(
        invitation.id,
        { status: EInvitationStatus.EXPIRED },
        { companyId: invitation.companyId },
      );
      throw new ConflictException('This invitation has expired.');
    }

    const company = await this.dataSource.getRepository(Company).findOne({
      where: { id: invitation.companyId },
      select: { id: true, name: true },
    });
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

    const outcome = await this.dataSource.transaction(async (manager) => {
      const invitations = manager.getRepository(CompanyInvitation);
      const invitation = await invitations
        .createQueryBuilder('invitation')
        .addSelect('invitation.tokenHash')
        .where('invitation.tokenHash = :tokenHash', {
          tokenHash: hashToken(token),
        })
        .setLock('pessimistic_write')
        .getOne();

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
        await invitations.save(invitation);
        return { status: EInvitationStatus.EXPIRED as const };
      }

      if (decision === 'decline') {
        invitation.status = EInvitationStatus.DECLINED;
        await invitations.save(invitation);
        return { status: EInvitationStatus.DECLINED as const };
      }

      const members = manager.getRepository(CompanyUser);
      const existingMembership = await members.findOne({
        where: {
          companyId: invitation.companyId,
          userId,
        },
        lock: { mode: 'pessimistic_write' },
      });
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
        await members.save(existingMembership);
      } else {
        await members.save(
          members.create({
            companyId: invitation.companyId,
            userId,
            companyRole: membershipRole,
            jobTitle: invitation.companyRole,
            status: ECompanyUserStatus.ACTIVE,
            joinedAt: new Date(),
            leftAt: null,
          }),
        );
      }

      invitation.status = EInvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      await invitations.save(invitation);
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

    return this.dataSource.transaction(async (manager) => {
      const { scope } = await this.lockCompanyAdmin(manager, userId, companyId);
      const companies = manager.getRepository(Company);
      const company = await companies.findOne({
        where: { id: scope.companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!company) {
        throw new NotFoundException('Company was not found.');
      }
      Object.assign(company, dto);
      const saved = await companies.save(company);
      return CompanyResponseDto.fromEntity(saved);
    });
  }

  private async requireCompanyAdmin(
    userId: string,
    companyId: string,
  ): Promise<ICompanyScope> {
    const scope = await this.companyScope.forUser(userId, companyId);
    const membership = await this.companyUsers.findOne({
      where: {
        userId,
        companyId: scope.companyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      select: { id: true, companyRole: true },
    });
    if (membership?.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only company administrators can manage this company.',
      );
    }
    return scope;
  }

  private async lockCompanyAdmin(
    manager: EntityManager,
    userId: string,
    companyId: string,
  ): Promise<{
    company: Company;
    membership: CompanyUser;
    scope: ICompanyScope;
  }> {
    const normalizedCompanyId = companyId?.trim();
    const companies = manager.getRepository(Company);
    const company = normalizedCompanyId
      ? await companies.findOne({
          where: { id: normalizedCompanyId },
          lock: { mode: 'pessimistic_write' },
        })
      : null;
    if (!company) {
      throw new ForbiddenException('Active company membership is required.');
    }

    const membership = await manager.getRepository(CompanyUser).findOne({
      where: {
        userId,
        companyId: normalizedCompanyId,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!membership || membership.companyRole !== ECompanyRole.COMPANY_ADMIN) {
      throw new ForbiddenException(
        'Only company administrators can manage this company.',
      );
    }

    return {
      company,
      membership,
      scope: Object.freeze({ companyId: normalizedCompanyId }),
    };
  }

  private async countActiveAdmins(
    members: Repository<CompanyUser>,
    companyId: string,
  ): Promise<number> {
    return members.count({
      where: {
        companyId,
        companyRole: ECompanyRole.COMPANY_ADMIN,
        status: ECompanyUserStatus.ACTIVE,
        leftAt: IsNull(),
      },
    });
  }
}
