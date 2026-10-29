import { EUserStatus } from '@contractflow/contracts-schema';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AppUser } from '../entities/app-user.entity';
import { AppUserRepository } from '../repositories/app-user.repository';
import { ICreateAppUserInput } from '../interface/app-user.interface';

@Injectable()
export class AppUserService {
  constructor(private readonly users: AppUserRepository) {}

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  getById(id: string): Promise<AppUser> {
    return this.users.findByIdOrFail(undefined, id);
  }

  getByEmail(email: string): Promise<AppUser> {
    return this.users.findByEmailOrFail(email);
  }

  list(params: CursorParams = {}): Promise<CursorPage<AppUser>> {
    return this.users.paginateByCursor(undefined, params);
  }

  search(
    term: string,
    params: PaginationParams & { status?: EUserStatus } = {},
  ): Promise<Page<AppUser>> {
    return this.users.search(term, params);
  }

  countByStatus(status: EUserStatus): Promise<number> {
    return this.users.countByStatus(status);
  }

  // ---------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------

  async create(input: ICreateAppUserInput): Promise<AppUser> {
    this.assertPasswordPolicy(input.password);

    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictException('Email is already in use');
    }

    const entity = this.users.create(undefined, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      middleName: input.middleName ?? '',
      phoneNumber: input.phoneNumber ?? '',
      timezone: input.timezone ?? 'UTC',
      passwordHash: await this.passwordHasher.hash(input.password),
      status: EUserStatus.ACTIVE,
      isPlatformAdmin: false,
      mfaEnabled: false,
      emailVerifiedAt: null,
      lastLoginAt: null,
    });

    const saved = await this.users.save(undefined, entity);
    // Re-read so the returned user never carries the password hash.
    return this.getById(saved.id);
  }

  // ---------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------

  /**
   * Only active users may log in. Every failure (unknown email, wrong
   * password, non-active account) returns the same error.
   */
  async authenticate(email: string, password: string): Promise<AppUser> {
    const user = await this.users.findByEmailWithPassword(email);
    const passwordMatches = await this.passwordHasher.verify(
      password,
      user?.passwordHash,
    );

    if (!user || !passwordMatches || user.status !== EUserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.users.updateLastLogin(user.id);
    return this.getById(user.id);
  }

  // async changePassword(
  //   id: string,
  //   currentPassword: string,
  //   newPassword: string,
  // ): Promise<void> {
  //   this.assertPasswordPolicy(newPassword);

  //   const user = await this.users.findByIdWithPassword(id);
  //   if (!user) throw new NotFoundException(`User with id ${id} not found`);

  //   if (
  //     !(await this.passwordHasher.verify(currentPassword, user.passwordHash))
  //   ) {
  //     throw new BadRequestException('Current password is incorrect');
  //   }

  //   await this.users.updatePasswordHash(
  //     id,
  //     await this.passwordHasher.hash(newPassword),
  //   );
  // }

  /** For forgot-password / admin flows where the caller is already authorised. */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    this.assertPasswordPolicy(newPassword);
    await this.users.updatePasswordHash(
      id,
      await this.passwordHasher.hash(newPassword),
    );
  }

  async markEmailVerified(id: string): Promise<AppUser> {
    await this.users.markEmailVerified(id);
    return this.getById(id);
  }

  async setMfaEnabled(id: string, enabled: boolean): Promise<AppUser> {
    await this.users.setMfaEnabled(id, enabled);
    return this.getById(id);
  }

  // ---------------------------------------------------------------------
  // Account management
  // ---------------------------------------------------------------------

  async updateProfile(
    id: string,
    input: IUpdateAppUserProfileInput,
  ): Promise<AppUser> {
    await this.users.updateProfile(id, input);
    return this.getById(id); // also throws NotFound for an unknown id
  }

  /** The repository clears email verification, since the new address is unproven. */
  async changeEmail(id: string, email: string): Promise<AppUser> {
    if (await this.users.existsByEmail(email, id)) {
      throw new ConflictException('Email is already in use');
    }
    await this.users.updateEmail(id, email);
    return this.getById(id);
  }

  async changeStatus(id: string, status: EUserStatus): Promise<AppUser> {
    await this.users.setStatus(id, status);
    return this.getById(id);
  }

  /** Only existing platform admins may grant or revoke platform admin. */
  async setPlatformAdmin(
    actorId: string,
    targetId: string,
    isPlatformAdmin: boolean,
  ): Promise<AppUser> {
    const actor = await this.users.findById(undefined, actorId);
    if (!actor?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    if (actorId === targetId && !isPlatformAdmin) {
      throw new BadRequestException(
        'You cannot remove your own platform admin access',
      );
    }

    await this.users.setPlatformAdmin(targetId, isPlatformAdmin);
    return this.getById(targetId);
  }
}
