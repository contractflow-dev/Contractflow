import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EUserStatus } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailService } from '../../../mail/mail.service';
import type { AppUser } from '../../entities/app-user.entity';
import type { PasswordResetToken } from '../../entities/password-reset-token.entity';
import type {
  IPasswordResetTransactionContext,
  IPasswordResetUnitOfWork,
} from '../../interface/password-reset-persistence.interface';
import {
  GENERIC_RESET_REQUEST_MESSAGE,
  PASSWORD_RESET_MESSAGE,
  RESET_LINK_INVALID_MESSAGE,
  RESET_REQUESTS_PER_HOUR,
  RESET_TOKEN_TTL_MINUTES,
  PasswordResetService,
} from './password-reset.service';
import type { PasswordService } from './password.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'u-1',
    email: 'ada@example.com',
    status: EUserStatus.ACTIVE,
    emailVerifiedAt: new Date('2026-01-01'),
    ...overrides,
  } as AppUser;
}

function token(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
  return {
    id: 't-1',
    userId: 'u-1',
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    ...overrides,
  } as PasswordResetToken;
}

describe('PasswordResetService', () => {
  let context: {
    users: Record<'findByEmailForUpdate' | 'findByIdForUpdate' | 'updatePasswordHash', ReturnType<typeof vi.fn>>;
    resetTokens: Record<
      | 'createToken'
      | 'saveToken'
      | 'findByHashForUpdate'
      | 'findLatestForUser'
      | 'countCreatedSince'
      | 'consume'
      | 'invalidateUnusedForUser',
      ReturnType<typeof vi.fn>
    >;
    sessions: Record<'revokeAllActiveForUser', ReturnType<typeof vi.fn>>;
  };
  let mail: { sendPasswordResetEmail: ReturnType<typeof vi.fn> };
  let passwords: { hash: ReturnType<typeof vi.fn> };
  let service: PasswordResetService;

  beforeEach(() => {
    context = {
      users: {
        findByEmailForUpdate: vi.fn().mockResolvedValue(user()),
        findByIdForUpdate: vi.fn().mockResolvedValue(user()),
        updatePasswordHash: vi.fn().mockResolvedValue(undefined),
      },
      resetTokens: {
        createToken: vi.fn((value) => value),
        saveToken: vi.fn(async (value) => ({ ...value, id: 't-new' })),
        findByHashForUpdate: vi.fn().mockResolvedValue(token()),
        findLatestForUser: vi.fn().mockResolvedValue(null),
        countCreatedSince: vi.fn().mockResolvedValue(0),
        consume: vi.fn().mockResolvedValue(true),
        invalidateUnusedForUser: vi.fn().mockResolvedValue(undefined),
      },
      sessions: { revokeAllActiveForUser: vi.fn().mockResolvedValue(undefined) },
    };
    const unitOfWork: IPasswordResetUnitOfWork = {
      execute: (operation) =>
        operation(context as unknown as IPasswordResetTransactionContext),
    };
    mail = { sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined) };
    passwords = { hash: vi.fn().mockResolvedValue('new-password-hash') };
    service = new PasswordResetService(
      unitOfWork,
      mail as unknown as MailService,
      passwords as unknown as PasswordService,
    );
  });

  /** The raw token emailed by the last request. */
  async function sentToken(): Promise<string> {
    await vi.waitFor(() => expect(mail.sendPasswordResetEmail).toHaveBeenCalled());
    return mail.sendPasswordResetEmail.mock.calls[0][1] as string;
  }

  describe('requestReset', () => {
    it('emails a random single-use link and stores only its hash', async () => {
      const result = await service.requestReset('ada@example.com');

      expect(result).toEqual({ message: GENERIC_RESET_REQUEST_MESSAGE });
      const raw = await sentToken();
      // 32 random bytes, base64url.
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const stored = context.resetTokens.createToken.mock.calls[0][0];
      expect(stored.tokenHash).toBe(sha256(raw));
      expect(stored.tokenHash).not.toContain(raw);
      expect(stored.usedAt).toBeNull();
      const lifetime = stored.expiresAt.getTime() - Date.now();
      expect(lifetime).toBeGreaterThan((RESET_TOKEN_TTL_MINUTES - 1) * 60_000);
      expect(lifetime).toBeLessThanOrEqual(RESET_TOKEN_TTL_MINUTES * 60_000);
      expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'ada@example.com',
        raw,
        RESET_TOKEN_TTL_MINUTES,
      );
      // Earlier links stop working.
      expect(context.resetTokens.invalidateUnusedForUser).toHaveBeenCalledWith(
        'u-1',
        expect.any(Date),
      );
    });

    it('gives tokens that differ every time', async () => {
      await service.requestReset('ada@example.com');
      await service.requestReset('ada@example.com');
      await vi.waitFor(() =>
        expect(mail.sendPasswordResetEmail).toHaveBeenCalledTimes(2),
      );
      const [first, second] = mail.sendPasswordResetEmail.mock.calls.map(
        (call) => call[1],
      );
      expect(first).not.toBe(second);
    });

    it.each([
      ['an unknown address', null],
      ['a suspended account', user({ status: EUserStatus.SUSPENDED })],
      ['an unverified account', user({ emailVerifiedAt: null })],
    ])('answers the same for %s and sends nothing', async (_case, found) => {
      context.users.findByEmailForUpdate.mockResolvedValue(found);

      await expect(service.requestReset('who@example.com')).resolves.toEqual({
        message: GENERIC_RESET_REQUEST_MESSAGE,
      });
      expect(context.resetTokens.saveToken).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('limits each account to one email a minute, silently', async () => {
      context.resetTokens.findLatestForUser.mockResolvedValue(
        token({ createdAt: new Date(Date.now() - 20_000) }),
      );

      await expect(service.requestReset('ada@example.com')).resolves.toEqual({
        message: GENERIC_RESET_REQUEST_MESSAGE,
      });
      expect(context.resetTokens.saveToken).not.toHaveBeenCalled();
    });

    it('limits each account per hour, silently', async () => {
      context.resetTokens.countCreatedSince.mockResolvedValue(
        RESET_REQUESTS_PER_HOUR,
      );

      await expect(service.requestReset('ada@example.com')).resolves.toEqual({
        message: GENERIC_RESET_REQUEST_MESSAGE,
      });
      expect(context.resetTokens.saveToken).not.toHaveBeenCalled();
      const since = context.resetTokens.countCreatedSince.mock.calls[0][1] as Date;
      expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    });

    it('answers before the email is sent, and voids a link that could not be sent', async () => {
      let fail: (error: Error) => void = () => undefined;
      mail.sendPasswordResetEmail.mockReturnValue(
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      );

      // The response doesn't wait for delivery.
      await expect(service.requestReset('ada@example.com')).resolves.toEqual({
        message: GENERIC_RESET_REQUEST_MESSAGE,
      });
      expect(context.resetTokens.consume).not.toHaveBeenCalled();

      fail(new Error('SMTP down'));
      await vi.waitFor(() =>
        expect(context.resetTokens.consume).toHaveBeenCalledWith(
          't-new',
          expect.any(Date),
        ),
      );
    });
  });

  describe('resetPassword', () => {
    it('sets the new password, spends the token, voids others and signs out everywhere', async () => {
      await expect(
        service.resetPassword('raw-token-value', 'New-Password-123'),
      ).resolves.toEqual({ message: PASSWORD_RESET_MESSAGE });

      expect(passwords.hash).toHaveBeenCalledWith('New-Password-123');
      expect(context.resetTokens.findByHashForUpdate).toHaveBeenCalledWith(
        sha256('raw-token-value'),
      );
      expect(context.resetTokens.consume).toHaveBeenCalledWith(
        't-1',
        expect.any(Date),
      );
      expect(context.resetTokens.invalidateUnusedForUser).toHaveBeenCalledWith(
        'u-1',
        expect.any(Date),
      );
      expect(context.users.updatePasswordHash).toHaveBeenCalledWith(
        'u-1',
        'new-password-hash',
      );
      expect(context.sessions.revokeAllActiveForUser).toHaveBeenCalledWith(
        'u-1',
        expect.any(Date),
      );
    });

    it.each([
      ['an unknown token', null],
      ['a used token', token({ usedAt: new Date() })],
      ['an expired token', token({ expiresAt: new Date(Date.now() - 1) })],
    ])('refuses %s and changes nothing', async (_case, found) => {
      context.resetTokens.findByHashForUpdate.mockResolvedValue(found);

      await expect(
        service.resetPassword('raw-token-value', 'New-Password-123'),
      ).rejects.toEqual(new BadRequestException(RESET_LINK_INVALID_MESSAGE));
      expect(context.users.updatePasswordHash).not.toHaveBeenCalled();
      expect(context.sessions.revokeAllActiveForUser).not.toHaveBeenCalled();
    });

    it('refuses a token another request has just spent', async () => {
      context.resetTokens.consume.mockResolvedValue(false);

      await expect(
        service.resetPassword('raw-token-value', 'New-Password-123'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(context.users.updatePasswordHash).not.toHaveBeenCalled();
      expect(context.sessions.revokeAllActiveForUser).not.toHaveBeenCalled();
    });

    it.each([
      ['no longer exists', null],
      ['is suspended', user({ status: EUserStatus.SUSPENDED })],
    ])('refuses when the account %s', async (_case, found) => {
      context.users.findByIdForUpdate.mockResolvedValue(found);

      await expect(
        service.resetPassword('raw-token-value', 'New-Password-123'),
      ).rejects.toEqual(new BadRequestException(RESET_LINK_INVALID_MESSAGE));
      expect(context.resetTokens.consume).not.toHaveBeenCalled();
      expect(context.users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('fails as a whole when a step fails', async () => {
      context.sessions.revokeAllActiveForUser.mockRejectedValue(
        new Error('database unavailable'),
      );

      // The unit of work rolls back the transaction on this rejection
      // (covered against PostgreSQL in the integration tests).
      await expect(
        service.resetPassword('raw-token-value', 'New-Password-123'),
      ).rejects.toThrow('database unavailable');
    });
  });
});
