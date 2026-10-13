import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { EUserStatus } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUser } from '../entities/app-user.entity';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { UserSession } from '../entities/user-session.entity';
import type { MailService } from '../../mail/mail.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let appUsers: Record<string, ReturnType<typeof vi.fn>>;
  let tokens: Record<string, ReturnType<typeof vi.fn>>;
  let sessions: Record<string, ReturnType<typeof vi.fn>>;
  let mail: { sendVerificationEmail: ReturnType<typeof vi.fn> };
  let transaction: ReturnType<typeof vi.fn>;

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
      createQueryBuilder: vi.fn(),
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
    sessions = {
      create: vi.fn((value) => value),
      save: vi.fn(async (value) => value),
      findOne: vi.fn(),
    };
    mail = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };

    const manager = {
      getRepository: (entity: typeof AppUser | typeof EmailVerificationToken) =>
        entity === AppUser ? appUsers : tokens,
    };
    transaction = vi.fn(
      async <T>(work: (manager: EntityManager) => Promise<T>) =>
        work(manager as unknown as EntityManager),
    );
    const dataSource = { transaction };
    const config = { get: vi.fn(() => undefined) };
    service = new AuthService(
      dataSource as unknown as DataSource,
      config as unknown as ConfigService,
      mail as unknown as MailService,
      appUsers as unknown as Repository<AppUser>,
      sessions as unknown as Repository<UserSession>,
    );
  });

  it('registers users without requiring a middle name', async () => {
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
    expect(savedUser.passwordHash).not.toBe('StrongPassword123!');
    expect(savedToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(savedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(response).not.toHaveProperty('token');
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      savedUser.email,
      expect.any(String),
    );
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('verifies an email exactly once and updates authoritative user state', async () => {
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
    tokens.findOne.mockResolvedValue(record);
    appUsers.findOne.mockResolvedValue(user);

    await expect(service.verifyEmail('test-token-with-enough-length')).resolves
      .toMatchObject({ message: 'Your email address is verified.' });

    expect(record.usedAt).toBeInstanceOf(Date);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(tokens.save).toHaveBeenCalledWith(record);
    expect(appUsers.save).toHaveBeenCalledWith(user);
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
      name: 'reused',
      record: {
        userId: 'user-id',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      },
    },
  ])('rejects an $name verification token', async ({ record }) => {
    tokens.findOne.mockResolvedValue(record);

    await expect(
      service.verifyEmail('test-token-with-enough-length'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(appUsers.save).not.toHaveBeenCalled();
    expect(tokens.save).not.toHaveBeenCalled();
  });

  it('rate-limits resend requests and does not invalidate tokens during cooldown', async () => {
    const user = {
      id: '01JUSER0000000000000000000',
      email: 'user@example.com',
      emailVerifiedAt: null,
    };
    appUsers.findOne.mockResolvedValue(user);
    tokens.findOne.mockResolvedValue({
      createdAt: new Date(),
      usedAt: null,
    });

    await expect(
      service.resendVerification('user@example.com'),
    ).resolves.toHaveProperty('message');
    expect(tokens.update).not.toHaveBeenCalled();
    expect(tokens.save).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('rejects login until the server-side verification timestamp is set', async () => {
    await service.register({
      email: 'user@example.com',
      firstName: 'User',
      middleName: '',
      lastName: 'Person',
      phoneNumber: '',
      timezone: 'UTC',
      password: 'StrongPassword123!',
    });
    const registeredUser = await appUsers.save.mock.results[0].value;
    const query = {
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(registeredUser),
    };
    appUsers.createQueryBuilder.mockReturnValue(query);

    await expect(
      service.login(
        { email: 'user@example.com', password: 'StrongPassword123!' },
        { ipAddress: null, userAgent: '' },
      ),
    ).rejects.toThrow('Verify your email before signing in.');
    expect(sessions.save).not.toHaveBeenCalled();
  });
});
