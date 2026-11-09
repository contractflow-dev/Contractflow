import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EUserStatus } from '@contractflow/contracts-schema';
import {
  Between,
  In,
  IsNull,
  Not,
  Repository,
  type DeepPartial,
} from 'typeorm';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import type {} from '../../../common/database/repositories/base.repository.interface';
import { AppUser } from '../entities/app-user.entity';
import { IUpdateAppUserProfileInput } from '../interface/app-user.interface';
import type {
  IAppUserRepository,
  ICreateAuthUser,
} from '../interface/auth-persistence.interface';
import type { IPasswordResetUserRepository } from '../interface/password-reset-persistence.interface';

@Injectable()
export class AppUserRepository
  extends BaseRepository<AppUser>
  implements IAppUserRepository, IPasswordResetUserRepository
{
  constructor(@InjectRepository(AppUser) repository: Repository<AppUser>) {
    super(repository);
  }

  // ---------------------------------------------------------------------
  // Overrides
  // ---------------------------------------------------------------------

  /** Normalizes the email so every stored value is trimmed and lowercase. */
  create(scope: void, data: DeepPartial<AppUser>): AppUser {
    return super.create(
      scope,
      typeof data.email === 'string'
        ? { ...data, email: this.normalizeEmail(data.email) }
        : data,
    );
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Escapes LIKE wildcards so user input is matched literally. */
  // private escapeLike(term: string): string {
  //   return term.replace(/[\\%_]/g, '\\$&');
  // }

  /** Runs a single UPDATE by id and throws if no row matched. */
  private async updateByIdOrFail(
    id: string,
    values: Parameters<Repository<AppUser>['update']>[1],
  ): Promise<void> {
    const result = await this.repository.update({ id }, values);
    if (!result.affected) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }

  // ---------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------

  async findByEmail(email: string): Promise<AppUser | null> {
    return this.repository.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async findByEmailOrFail(email: string): Promise<AppUser> {
    const user = await this.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmails(emails: string[]): Promise<AppUser[]> {
    if (!emails.length) return [];
    return this.repository.find({
      where: { email: In(emails.map((e) => this.normalizeEmail(e))) },
    });
  }

  async findByPhoneNumber(phoneNumber: string): Promise<AppUser | null> {
    return this.repository.findOne({
      where: { phoneNumber: phoneNumber.trim() },
    });
  }

  /**
   * For login flows: also selects the password hash, which is excluded
   * from normal queries because the column uses `select: false`.
   */
  async findByEmailWithPassword(email: string): Promise<AppUser | null> {
    return this.repository
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  createUser(data: ICreateAuthUser): AppUser {
    return this.create(undefined, {
      ...data,
      email: this.normalizeEmail(data.email),
    });
  }

  findByEmailForUpdate(email: string): Promise<AppUser | null> {
    return this.repository.findOne({
      where: { email: this.normalizeEmail(email) },
      lock: { mode: 'pessimistic_write' },
    });
  }

  findByIdForUpdate(id: string): Promise<AppUser | null> {
    return this.repository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  saveUser(user: AppUser): Promise<AppUser> {
    return this.repository.save(user);
  }

  /** Same as above, by id (e.g. "confirm current password" flows). */
  async findByIdWithPassword(id: string): Promise<AppUser | null> {
    return this.repository
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOne();
  }

  // ---------------------------------------------------------------------
  // Existence checks
  // ---------------------------------------------------------------------

  /** `excludeId` lets an update check uniqueness without matching itself. */
  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    return this.repository.exists({
      where: {
        email: this.normalizeEmail(email),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
  }

  async existsByPhoneNumber(
    phoneNumber: string,
    excludeId?: string,
  ): Promise<boolean> {
    return this.repository.exists({
      where: {
        phoneNumber: phoneNumber.trim(),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
  }

  // ---------------------------------------------------------------------
  // Listing & search
  // ---------------------------------------------------------------------

  async findByStatus(status: EUserStatus): Promise<AppUser[]> {
    return this.repository.find({ where: { status } });
  }

  async findActive(): Promise<AppUser[]> {
    return this.findByStatus(EUserStatus.ACTIVE);
  }

  async countByStatus(status: EUserStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async findPlatformAdmins(): Promise<AppUser[]> {
    return this.repository.find({ where: { isPlatformAdmin: true } });
  }

  /** Users who never verified their email. */
  async findUnverified(): Promise<AppUser[]> {
    return this.repository.find({ where: { emailVerifiedAt: IsNull() } });
  }

  /**
   * Users with no login since `before` (or who never logged in).
   * Useful for dormant-account cleanup or reminder emails.
   */
  async findInactiveSince(before: Date): Promise<AppUser[]> {
    return this.repository
      .createQueryBuilder('u')
      .where('u.lastLoginAt IS NULL OR u.lastLoginAt < :before', { before })
      .getMany();
  }

  async findCreatedBetween(from: Date, to: Date): Promise<AppUser[]> {
    return this.repository.find({
      where: { createdAt: Between(from, to) },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------
  // Targeted updates (single UPDATE, no read-back)
  // ---------------------------------------------------------------------

  async updateLastLogin(id: string, at: Date = new Date()): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt: at });
  }

  async setStatus(id: string, status: EUserStatus): Promise<void> {
    await this.updateByIdOrFail(id, { status });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.updateByIdOrFail(id, { passwordHash });
  }

  async markEmailVerified(id: string, at: Date = new Date()): Promise<void> {
    await this.updateByIdOrFail(id, { emailVerifiedAt: at });
  }

  /** Changing the email also clears verification: the new address is unproven. */
  async updateEmail(id: string, email: string): Promise<void> {
    await this.updateByIdOrFail(id, {
      email: this.normalizeEmail(email),
      emailVerifiedAt: null,
    });
  }

  async setMfaEnabled(id: string, enabled: boolean): Promise<void> {
    await this.updateByIdOrFail(id, { mfaEnabled: enabled });
  }

  async setPlatformAdmin(id: string, isPlatformAdmin: boolean): Promise<void> {
    await this.updateByIdOrFail(id, { isPlatformAdmin });
  }

  /** Updates only the profile fields that are actually provided. */
  async updateProfile(
    id: string,
    data: IUpdateAppUserProfileInput,
  ): Promise<void> {
    const values = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(values).length === 0) return;
    await this.updateByIdOrFail(id, values);
  }
}
