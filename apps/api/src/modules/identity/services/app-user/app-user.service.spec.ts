import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EUserStatus } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUser } from '../../entities/app-user.entity';
import type { IAppUserAccountTransactionContext } from '../../interface/app-user-account-persistence.interface';
import type { PasswordService } from '../auth/password.service';
import { AppUserService, PASSWORD_CHANGED_MESSAGE } from './app-user.service';

const user = {
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  middleName: '',
  lastName: 'Okafor',
  phoneNumber: '+2348000000000',
  timezone: 'Africa/Lagos',
  status: EUserStatus.ACTIVE,
  isPlatformAdmin: false,
  mfaEnabled: false,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  passwordHash: 'stored-hash',
} as unknown as AppUser;

describe('AppUserService', () => {
  let context: {
    users: {
      findProfileById: ReturnType<typeof vi.fn>;
      findPasswordHash: ReturnType<typeof vi.fn>;
      findPasswordHashForUpdate: ReturnType<typeof vi.fn>;
      updateProfile: ReturnType<typeof vi.fn>;
      updatePasswordHash: ReturnType<typeof vi.fn>;
    };
    sessions: { revokeAllActiveForUserExcept: ReturnType<typeof vi.fn> };
  };
  let passwords: {
    verify: ReturnType<typeof vi.fn>;
    hash: ReturnType<typeof vi.fn>;
  };
  let service: AppUserService;

  beforeEach(() => {
    context = {
      users: {
        findProfileById: vi.fn().mockResolvedValue(user),
        findPasswordHash: vi.fn().mockResolvedValue('stored-hash'),
        findPasswordHashForUpdate: vi.fn().mockResolvedValue('stored-hash'),
        updateProfile: vi.fn().mockResolvedValue(undefined),
        updatePasswordHash: vi.fn().mockResolvedValue(undefined),
      },
      sessions: {
        revokeAllActiveForUserExcept: vi.fn().mockResolvedValue(undefined),
      },
    };
    passwords = {
      // Only "Current-Pass-1" matches the stored hash.
      verify: vi.fn(async (password: string) => password === 'Current-Pass-1'),
      hash: vi.fn().mockResolvedValue('new-hash'),
    };
    const unitOfWork = {
      execute: vi.fn(
        <T>(work: (ctx: IAppUserAccountTransactionContext) => Promise<T>) =>
          work(context as unknown as IAppUserAccountTransactionContext),
      ),
    };
    service = new AppUserService(
      unitOfWork as never,
      passwords as unknown as PasswordService,
    );
  });

  describe('getProfile', () => {
    it('returns only client-appropriate fields', async () => {
      const profile = await service.getProfile('user-1');

      expect(context.users.findProfileById).toHaveBeenCalledWith('user-1');
      expect(profile).toMatchObject({ id: 'user-1', email: 'ada@example.com' });
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('mfaEnabled');
    });

    it('reports a missing user as not found', async () => {
      context.users.findProfileById.mockResolvedValue(null);
      await expect(service.getProfile('gone')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('writes only the provided profile fields, and returns the new profile', async () => {
      const result = await service.updateProfile('user-1', {
        firstName: 'Adaeze',
        middleName: '',
        timezone: 'Europe/London',
      });

      expect(context.users.updateProfile).toHaveBeenCalledWith('user-1', {
        firstName: 'Adaeze',
        middleName: '',
        timezone: 'Europe/London',
      });
      expect(result).toMatchObject({ id: 'user-1' });
    });

    it('ignores anything that is not a profile field', async () => {
      await service.updateProfile('user-1', {
        lastName: 'Eze',
        email: 'attacker@example.com',
        isPlatformAdmin: true,
        status: EUserStatus.ACTIVE,
      } as never);

      expect(context.users.updateProfile).toHaveBeenCalledWith('user-1', {
        lastName: 'Eze',
      });
    });

    it('refuses an empty change', async () => {
      await expect(service.updateProfile('user-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(context.users.updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const request = {
      currentPassword: 'Current-Pass-1',
      newPassword: 'Brand-New-Pass-2',
    };

    it('stores the new hash and signs out every other session, keeping this one', async () => {
      await expect(
        service.changePassword('user-1', 'session-1', request),
      ).resolves.toEqual({ message: PASSWORD_CHANGED_MESSAGE });

      expect(passwords.hash).toHaveBeenCalledWith('Brand-New-Pass-2');
      expect(context.users.updatePasswordHash).toHaveBeenCalledWith(
        'user-1',
        'new-hash',
      );
      expect(context.sessions.revokeAllActiveForUserExcept).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        expect.any(Date),
      );
    });

    it('refuses a wrong current password with 400, changing nothing', async () => {
      await expect(
        service.changePassword('user-1', 'session-1', {
          ...request,
          currentPassword: 'Wrong-Pass-9',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(passwords.hash).not.toHaveBeenCalled();
      expect(context.users.updatePasswordHash).not.toHaveBeenCalled();
      expect(context.sessions.revokeAllActiveForUserExcept).not.toHaveBeenCalled();
    });

    it('refuses reusing the current password', async () => {
      await expect(
        service.changePassword('user-1', 'session-1', {
          currentPassword: 'Current-Pass-1',
          newPassword: 'Current-Pass-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(context.users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('refuses with 409 when the password changed concurrently', async () => {
      context.users.findPasswordHashForUpdate.mockResolvedValue('other-hash');

      await expect(
        service.changePassword('user-1', 'session-1', request),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(context.users.updatePasswordHash).not.toHaveBeenCalled();
      expect(context.sessions.revokeAllActiveForUserExcept).not.toHaveBeenCalled();
    });

    it('reports a missing user as not found', async () => {
      context.users.findPasswordHash.mockResolvedValue(null);
      await expect(
        service.changePassword('gone', 'session-1', request),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
