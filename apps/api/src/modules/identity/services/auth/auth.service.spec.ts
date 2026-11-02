import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager } from 'typeorm';
import { EUserStatus } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailService } from '../../../mail/mail.service';
import type { AuthenticatedSession } from '../../interface/auth-context.interface';
import type { AppUserRepository } from '../../repositories/app-user.repository';
import type { EmailVerificationTokenRepository } from '../../repositories/email-verification-token.repository';
import { AuthService } from './auth.service';
import type { PasswordService } from './password.service';
import type { SessionService } from './session.service';

describe('AuthService', () => {
  let service: AuthService;
  let appUsers: Record<string, ReturnType<typeof vi.fn>>;
  let appUserRepository: Record<string, ReturnType<typeof vi.fn>>;
  let tokens: Record<string, ReturnType<typeof vi.fn>>;
  let tokenRepository: Record<string, ReturnType<typeof vi.fn>>;
  let passwordService: Record<string, ReturnType<typeof vi.fn>>;
  let sessionService: Record<string, ReturnType<typeof vi.fn>>;
  let mail: { sendVerificationEmail: ReturnType<typeof vi.fn> };
  let transaction: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    appUsers = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => ({
        ...value,
        id: '01JUSER0000000000000000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findOne: vi.fn(),
    };
    appUserRepository = {
      findByEmailWithPassword: vi.fn(),
      updateLastLogin: vi.fn().mockResolvedValue(undefined),
      createInTransaction: vi.fn((_manager, value) => appUsers.create(value)),
      saveInTransaction: vi.fn((_manager, value) => appUsers.save(value)),
      findByEmailForUpdate: vi.fn((_manager, email) =>
        appUsers.findOne({ where: { email: email.trim().toLowerCase() } }),
      ),
      findByIdForUpdate: vi.fn((_manager, id) =>
        appUsers.findOne({ where: { id } }),
      ),
    };
    tokens = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => ({
        ...value,
        id: '01JTOKEN0000000000000000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findOne: vi.fn(),
      update: vi.fn(),
    };
    tokenRepository = {
      createInTransaction: vi.fn((_manager, value) => tokens.create(value)),
      saveInTransaction: vi.fn((_manager, value) => tokens.save(value)),
      findByHashForUpdate: vi.fn((_manager, tokenHash) =>
        tokens.findOne({ where: { tokenHash } }),
      ),
      findLatestForUser: vi.fn((_manager, userId) =>
        tokens.findOne({
          where: { userId },
          order: { createdAt: 'DESC' },
        }),
      ),
      invalidateUnusedForUser: vi.fn((_manager, userId, at) =>
        tokens.update({ userId }, { usedAt: at }),
      ),
    };
    passwordService = {
      hash: vi.fn().mockResolvedValue('argon2-hash'),
      verify: vi.fn().mockResolvedValue(true),
    };
    sessionService = {
      createSession: vi.fn().mockResolvedValue({
        sessionToken: 'session-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
      authenticate: vi.fn(),
      revokeSession: vi.fn().mockResolvedValue(undefined),
    };
    mail = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };

    const manager = {};
    transaction = vi.fn(
      async <T>(work: (manager: EntityManager) => Promise<T>) =>
        work(manager as unknown as EntityManager),
    );
    const dataSource = { transaction };
    configGet = vi.fn((key: string) => {
      if (key === 'SESSION_TTL_DAYS') return '7';
      return undefined;
    });
    const config = { get: configGet };

    service = new AuthService(
      dataSource as unknown as DataSource,
      config as unknown as ConfigService,
      mail as unknown as MailService,
      appUserRepository as unknown as AppUserRepository,
      tokenRepository as unknown as EmailVerificationTokenRepository,
      passwordService as unknown as PasswordService,
      sessionService as unknown as SessionService,
    );
  });

  it('creates the user and verification token in one transaction', async () => {
    const response = await service.register({
      email: '  USER@example.com ',
      firstName: ' User ',
      lastName: ' Person ',
      phoneNumber: '',
      timezone: 'UTC',
      password: 'StrongPassword123!',
    });

    const savedUser = appUsers.save.mock.calls[0][0];
    const savedToken = tokens.save.mock.calls[0][0];
    expect(savedUser.email).toBe('user@example.com');
    expect(savedUser.middleName).toBe('');
    expect(savedUser.passwordHash).toBe('argon2-hash');
    expect(passwordService.hash).toHaveBeenCalledWith('StrongPassword123!');
    expect(savedToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(response).not.toHaveProperty('token');
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      savedUser.email,
      expect.any(String),
    );
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('maps a duplicate email constraint to a conflict response', async () => {
    appUserRepository.saveInTransaction.mockRejectedValue({
      driverError: { code: '23505' },
    });

    await expect(
      service.register({
        email: 'user@example.com',
        firstName: 'User',
        lastName: 'Person',
        phoneNumber: '',
        timezone: 'UTC',
        password: 'StrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('verifies an email and updates the token and user atomically', async () => {
    const record = {
      userId: '01JUSER0000000000000000000',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const user = {
      id: record.userId,
      status: EUserStatus.ACTIVE,
      emailVerifiedAt: null,
    };
    tokenRepository.findByHashForUpdate.mockResolvedValue(record);
    appUsers.findOne.mockResolvedValue(user);

    await expect(
      service.verifyEmail('test-token-with-enough-length'),
    ).resolves.toMatchObject({ message: 'Your email address is verified.' });

    expect(record.usedAt).toBeInstanceOf(Date);
    expect(user.emailVerifiedAt).toBe(record.usedAt);
    expect(tokenRepository.saveInTransaction).toHaveBeenCalledWith(
      expect.any(Object),
      record,
    );
    expect(appUserRepository.saveInTransaction).toHaveBeenCalledWith(
      expect.any(Object),
      user,
    );
    expect(transaction).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: 'expired',
      record: {
        userId: 'user-id',
        expiresAt: new Date(Date.now() - 1),
        usedAt: null,
      },
    },
    {
      name: 'already used',
      record: {
        userId: 'user-id',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      },
    },
  ])('rejects an $name verification token', async ({ record }) => {
    tokenRepository.findByHashForUpdate.mockResolvedValue(record);

    await expect(
      service.verifyEmail('test-token-with-enough-length'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(appUserRepository.saveInTransaction).not.toHaveBeenCalled();
    expect(tokenRepository.saveInTransaction).not.toHaveBeenCalled();
  });

  it('rate-limits verification resends without invalidating the current token', async () => {
    appUserRepository.findByEmailForUpdate.mockResolvedValue({
      id: '01JUSER0000000000000000000',
      email: 'user@example.com',
      status: EUserStatus.ACTIVE,
      emailVerifiedAt: null,
    });
    tokenRepository.findLatestForUser.mockResolvedValue({
      createdAt: new Date(),
      usedAt: null,
    });

    await expect(
      service.resendVerification('user@example.com'),
    ).resolves.toHaveProperty('message');
    expect(tokenRepository.invalidateUnusedForUser).not.toHaveBeenCalled();
    expect(tokenRepository.saveInTransaction).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('rotates and sends a verification token after the resend cooldown', async () => {
    appUserRepository.findByEmailForUpdate.mockResolvedValue({
      id: '01JUSER0000000000000000000',
      email: 'user@example.com',
      status: EUserStatus.ACTIVE,
      emailVerifiedAt: null,
    });
    tokenRepository.findLatestForUser.mockResolvedValue(null);

    await expect(
      service.resendVerification('USER@example.com'),
    ).resolves.toHaveProperty('message');

    expect(tokenRepository.invalidateUnusedForUser).toHaveBeenCalledWith(
      expect.any(Object),
      '01JUSER0000000000000000000',
      expect.any(Date),
    );
    const savedToken = tokens.save.mock.calls[0][0];
    expect(savedToken.userId).toBe('01JUSER0000000000000000000');
    expect(savedToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String),
    );
  });

  it('does not create sessions for users whose email is unverified', async () => {
    appUserRepository.findByEmailWithPassword.mockResolvedValue({
      id: '01JUSER0000000000000000000',
      passwordHash: 'argon2-hash',
      status: EUserStatus.ACTIVE,
      emailVerifiedAt: null,
    });

    await expect(
      service.login(
        { email: 'user@example.com', password: 'StrongPassword123!' },
        { ipAddress: null, userAgent: '' },
      ),
    ).rejects.toThrow('Verify your email before signing in.');
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('creates a session and updates the user last-login timestamp', async () => {
    const user = {
      id: '01JUSER0000000000000000000',
      email: 'user@example.com',
      firstName: 'User',
      middleName: '',
      lastName: 'Person',
      phoneNumber: '',
      timezone: 'UTC',
      status: EUserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
      isPlatformAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: 'argon2-hash',
    };
    appUserRepository.findByEmailWithPassword.mockResolvedValue(user);
    const result = await service.login(
      { email: user.email, password: 'StrongPassword123!' },
      { ipAddress: null, userAgent: 'test-agent' },
    );

    expect(passwordService.verify).toHaveBeenCalledWith(
      'StrongPassword123!',
      'argon2-hash',
    );
    expect(sessionService.createSession).toHaveBeenCalledWith(
      user,
      { ipAddress: null, userAgent: 'test-agent' },
      7,
    );
    expect(appUserRepository.updateLastLogin).toHaveBeenCalledWith(
      user.id,
      user.lastLoginAt,
    );
    expect(result.sessionToken).toBe('session-token');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.user.lastLoginAt).toBe(user.lastLoginAt);
  });

  it('delegates authentication and revocation to the session service', async () => {
    const authenticated: AuthenticatedSession = {
      user: {
        id: '01JUSER0000000000000000000',
        email: 'user@example.com',
        emailVerifiedAt: new Date(),
        isPlatformAdmin: false,
      },
      sessionId: '01JSESSION000000000000000000',
    };
    sessionService.authenticate.mockResolvedValue(authenticated);

    await expect(service.authenticate('session-token')).resolves.toBe(
      authenticated,
    );
    await expect(service.logout('session-token')).resolves.toBeUndefined();
    expect(sessionService.authenticate).toHaveBeenCalledWith('session-token');
    expect(sessionService.revokeSession).toHaveBeenCalledWith('session-token');
  });

  it('exposes the standard session cookie name', () => {
    expect(service.sessionCookieName()).toBe('contractflow_session');
  });
});
