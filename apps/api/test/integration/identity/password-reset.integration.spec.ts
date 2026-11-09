import { createHash, randomUUID } from 'node:crypto';
import { EUserStatus } from '@contractflow/contracts-schema';
import type { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { AppUser } from '../../../src/modules/identity/entities/app-user.entity';
import { PasswordResetToken } from '../../../src/modules/identity/entities/password-reset-token.entity';
import { UserSession } from '../../../src/modules/identity/entities/user-session.entity';
import { PasswordResetTransactionContextFactory } from '../../../src/modules/identity/repositories/password-reset-transaction-context.factory';
import { UserSessionRepository } from '../../../src/modules/identity/repositories/user-session.repository';
import {
  GENERIC_RESET_REQUEST_MESSAGE,
  PasswordResetService,
} from '../../../src/modules/identity/services/auth/password-reset.service';
import { PasswordService } from '../../../src/modules/identity/services/auth/password.service';
import { SessionService } from '../../../src/modules/identity/services/auth/session.service';
import type { MailService } from '../../../src/modules/mail/mail.service';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const OLD_PASSWORD = 'Old-Password-123';
const NEW_PASSWORD = 'New-Password-456';

describe('Password reset (PostgreSQL)', () => {
  let dataSource: DataSource;
  let service: PasswordResetService;
  let sessions: SessionService;
  const passwords = new PasswordService();
  const sent: Array<{ email: string; token: string }> = [];
  const userIds = new Set<string>();

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    const mail = {
      sendPasswordResetEmail: async (email: string, token: string) => {
        sent.push({ email, token });
      },
    } as unknown as MailService;
    service = new PasswordResetService(
      new TypeOrmUnitOfWork(
        dataSource,
        new PasswordResetTransactionContextFactory(),
      ),
      mail,
      passwords,
    );
    sessions = new SessionService(
      new UserSessionRepository(dataSource.getRepository(UserSession)),
    );
  }, 60_000);

  afterEach(async () => {
    for (const id of userIds) {
      // Cascades to the user's sessions and reset tokens.
      await dataSource.getRepository(AppUser).delete({ id });
    }
    userIds.clear();
    sent.length = 0;
  });

  afterAll(async () => {
    await destroyPostgresTestDatabase();
  }, 60_000);

  async function createUser(): Promise<AppUser> {
    const suffix = randomUUID().slice(0, 8);
    const user = await dataSource.getRepository(AppUser).save(
      dataSource.getRepository(AppUser).create({
        email: `reset-${suffix}@integration.contractflow.test`,
        firstName: 'Reset',
        lastName: 'Tester',
        middleName: '',
        phoneNumber: '+2348000000000',
        passwordHash: await passwords.hash(OLD_PASSWORD),
        status: EUserStatus.ACTIVE,
        isPlatformAdmin: false,
        mfaEnabled: false,
        timezone: 'Africa/Lagos',
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
      }),
    );
    userIds.add(user.id);
    return user;
  }

  async function signIn(user: AppUser): Promise<string> {
    const { sessionToken } = await sessions.createSession(
      user,
      { ipAddress: null, userAgent: 'integration' },
      7,
    );
    return sessionToken;
  }

  /** Requests a reset and returns the raw token that was emailed. */
  async function requestToken(user: AppUser): Promise<string> {
    await service.requestReset(user.email);
    await vi.waitFor(() =>
      expect(sent.some((mail) => mail.email === user.email)).toBe(true),
    );
    return sent.filter((mail) => mail.email === user.email).at(-1)!.token;
  }

  async function storedHash(userId: string): Promise<string> {
    const row = await dataSource
      .getRepository(AppUser)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOneOrFail();
    return row.passwordHash;
  }

  async function tokens(userId: string): Promise<PasswordResetToken[]> {
    return dataSource
      .getRepository(PasswordResetToken)
      .find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  it('answers the same for registered and unknown addresses', async () => {
    const user = await createUser();

    const known = await service.requestReset(user.email);
    const unknown = await service.requestReset(
      `nobody-${randomUUID()}@integration.contractflow.test`,
    );

    expect(known).toEqual({ message: GENERIC_RESET_REQUEST_MESSAGE });
    expect(unknown).toEqual(known);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
  });

  it('stores only the hash of the emailed token', async () => {
    const user = await createUser();
    const raw = await requestToken(user);

    const [record] = await tokens(user.id);
    expect(record.tokenHash).toBe(sha256(raw));
    const rows = (await dataSource.query(
      'SELECT * FROM "password_reset_token" WHERE "user_id" = $1',
      [user.id],
    )) as Array<Record<string, unknown>>;
    expect(JSON.stringify(rows)).not.toContain(raw);
  });

  it('resets the password, spends the token, voids others and ends every session', async () => {
    const user = await createUser();
    const sessionA = await signIn(user);
    const sessionB = await signIn(user);
    const raw = await requestToken(user);
    // Another outstanding link (as if from an earlier request).
    await dataSource.getRepository(PasswordResetToken).save(
      dataSource.getRepository(PasswordResetToken).create({
        userId: user.id,
        tokenHash: sha256(`other-${randomUUID()}`),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      }),
    );

    await service.resetPassword(raw, NEW_PASSWORD);

    const hash = await storedHash(user.id);
    await expect(passwords.verify(NEW_PASSWORD, hash)).resolves.toBe(true);
    await expect(passwords.verify(OLD_PASSWORD, hash)).resolves.toBe(false);
    expect((await tokens(user.id)).every((token) => token.usedAt)).toBe(true);
    await expect(sessions.authenticate(sessionA)).rejects.toThrow();
    await expect(sessions.authenticate(sessionB)).rejects.toThrow();
  });

  it('refuses a used token', async () => {
    const user = await createUser();
    const raw = await requestToken(user);
    await service.resetPassword(raw, NEW_PASSWORD);

    await expect(
      service.resetPassword(raw, 'Another-Password-789'),
    ).rejects.toThrow('invalid, expired, or already used');
    await expect(
      passwords.verify(NEW_PASSWORD, await storedHash(user.id)),
    ).resolves.toBe(true);
  });

  it('refuses an expired token', async () => {
    const user = await createUser();
    const raw = await requestToken(user);
    await dataSource.query(
      `UPDATE "password_reset_token" SET "expires_at" = now() - interval '1 second' WHERE "user_id" = $1`,
      [user.id],
    );

    await expect(service.resetPassword(raw, NEW_PASSWORD)).rejects.toThrow(
      'invalid, expired, or already used',
    );
    await expect(
      passwords.verify(OLD_PASSWORD, await storedHash(user.id)),
    ).resolves.toBe(true);
  });

  it('lets only one of two simultaneous requests use a token', async () => {
    const user = await createUser();
    const raw = await requestToken(user);

    const results = await Promise.allSettled([
      service.resetPassword(raw, 'First-Password-111'),
      service.resetPassword(raw, 'Second-Password-222'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const hash = await storedHash(user.id);
    const first = await passwords.verify('First-Password-111', hash);
    const second = await passwords.verify('Second-Password-222', hash);
    expect(first !== second).toBe(true);
  });

  it('rolls everything back when one step fails', async () => {
    const user = await createUser();
    const session = await signIn(user);
    const raw = await requestToken(user);
    const suffix = randomUUID().replaceAll('-', '');
    await dataSource.query(`
      CREATE FUNCTION public."cf_it_raise_${suffix}"() RETURNS trigger LANGUAGE plpgsql AS $f$
      BEGIN
        IF NEW.user_id = '${user.id}' THEN
          RAISE EXCEPTION 'intentional integration-test failure' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $f$
    `);
    await dataSource.query(`
      CREATE TRIGGER "cf_it_fail_${suffix}" BEFORE UPDATE ON public."user_session"
      FOR EACH ROW EXECUTE FUNCTION public."cf_it_raise_${suffix}"()
    `);

    try {
      await expect(service.resetPassword(raw, NEW_PASSWORD)).rejects.toThrow();
    } finally {
      await dataSource.query(
        `DROP TRIGGER IF EXISTS "cf_it_fail_${suffix}" ON public."user_session"`,
      );
      await dataSource.query(
        `DROP FUNCTION IF EXISTS public."cf_it_raise_${suffix}"()`,
      );
    }

    // Nothing changed: old password, token unused, session still valid.
    await expect(
      passwords.verify(OLD_PASSWORD, await storedHash(user.id)),
    ).resolves.toBe(true);
    expect((await tokens(user.id))[0].usedAt).toBeNull();
    await expect(sessions.authenticate(session)).resolves.toMatchObject({
      user: { id: user.id },
    });
    // And the link still works afterwards.
    await service.resetPassword(raw, NEW_PASSWORD);
  });

  it('rate limits a single account without changing the answer', async () => {
    const user = await createUser();
    await requestToken(user);

    const again = await service.requestReset(user.email);

    expect(again).toEqual({ message: GENERIC_RESET_REQUEST_MESSAGE });
    expect(await tokens(user.id)).toHaveLength(1);
  });
});
