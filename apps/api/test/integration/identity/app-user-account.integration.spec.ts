import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { EUserStatus } from '@contractflow/contracts-schema';
import { TypeOrmUnitOfWork } from '../../../src/common/database/typeorm-unit-of-work';
import { SessionAuthGuard } from '../../../src/common/guards/session-auth.guard';
import { AppUserController } from '../../../src/modules/identity/controllers/app-user.controller';
import { AppUser } from '../../../src/modules/identity/entities/app-user.entity';
import type { CompanyUser } from '../../../src/modules/identity/entities/company-user.entity';
import { UserSession } from '../../../src/modules/identity/entities/user-session.entity';
import { APP_USER_ACCOUNT_UNIT_OF_WORK } from '../../../src/modules/identity/interface/app-user-account-persistence.interface';
import {
  APP_USER_REPOSITORY,
  AUTH_UNIT_OF_WORK,
} from '../../../src/modules/identity/interface/auth-persistence.interface';
import { AppUserAccountTransactionContextFactory } from '../../../src/modules/identity/repositories/app-user-account-transaction-context.factory';
import { UserSessionRepository } from '../../../src/modules/identity/repositories/user-session.repository';
import { AppUserService } from '../../../src/modules/identity/services/app-user/app-user.service';
import { AuthService } from '../../../src/modules/identity/services/auth/auth.service';
import { PasswordService } from '../../../src/modules/identity/services/auth/password.service';
import { SessionService } from '../../../src/modules/identity/services/auth/session.service';
import { MailService } from '../../../src/modules/mail/mail.service';
import { ContractTestFactory } from '../../fixtures/contract-test.factory';
import { integrationEntities } from '../database/integration-entities';
import {
  destroyPostgresTestDatabase,
  initializePostgresTestDatabase,
} from '../database/postgres-test-database';

const CURRENT_PASSWORD = 'Current-Pass-1';
const NEW_PASSWORD = 'Brand-New-Pass-2';

/**
 * The signed-in user's own account over real HTTP: session guard, global
 * validation, AppUserService and its unit of work, PostgreSQL.
 */
describe('App user account (PostgreSQL)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let factory: ContractTestFactory;
  let sessions: SessionService;
  let passwords: PasswordService;
  let cookieName: string;
  let member: CompanyUser;

  beforeAll(async () => {
    dataSource = await initializePostgresTestDatabase(integrationEntities);
    factory = new ContractTestFactory(dataSource);
    sessions = new SessionService(
      new UserSessionRepository(dataSource.getRepository(UserSession)),
    );
    passwords = new PasswordService();

    const moduleRef = await Test.createTestingModule({
      controllers: [AppUserController],
      providers: [
        AppUserService,
        { provide: PasswordService, useValue: passwords },
        {
          provide: APP_USER_ACCOUNT_UNIT_OF_WORK,
          useValue: new TypeOrmUnitOfWork(
            dataSource,
            new AppUserAccountTransactionContextFactory(),
          ),
        },
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        AuthService,
        { provide: SessionService, useValue: sessions },
        { provide: AUTH_UNIT_OF_WORK, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService({}) },
        { provide: MailService, useValue: {} },
        { provide: APP_USER_REPOSITORY, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    cookieName = moduleRef.get(AuthService).sessionCookieName();
  }, 60_000);

  beforeEach(async () => {
    ({ member } = await factory.createCompanyMember());
    await dataSource
      .getRepository(AppUser)
      .update(
        { id: member.userId },
        { passwordHash: await passwords.hash(CURRENT_PASSWORD) },
      );
  });

  afterEach(async () => {
    await factory.cleanup();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      await destroyPostgresTestDatabase();
    }
  }, 60_000);

  async function signIn(): Promise<string> {
    const user = await dataSource
      .getRepository(AppUser)
      .findOneByOrFail({ id: member.userId });
    const { sessionToken } = await sessions.createSession(
      user,
      { ipAddress: null, userAgent: 'integration' },
      1,
    );
    return `${cookieName}=${sessionToken}`;
  }

  const getMe = (cookie: string | null) => {
    const call = request(app.getHttpServer()).get('/api/users/me');
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const patchMe = (cookie: string | null, body: Record<string, unknown>) => {
    const call = request(app.getHttpServer()).patch('/api/users/me').send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const changePassword = (
    cookie: string | null,
    body: Record<string, unknown>,
  ) => {
    const call = request(app.getHttpServer())
      .post('/api/users/me/password')
      .send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const storedHash = async () =>
    (
      await dataSource
        .getRepository(AppUser)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('u.id = :id', { id: member.userId })
        .getOneOrFail()
    ).passwordHash;

  describe('GET /users/me', () => {
    it('returns the caller’s own profile without secrets', async () => {
      const response = await getMe(await signIn()).expect(200);
      expect(response.body).toMatchObject({
        id: member.userId,
        status: EUserStatus.ACTIVE,
        isPlatformAdmin: false,
      });
      expect(Object.keys(response.body as object).sort()).toEqual(
        [
          'createdAt',
          'email',
          'emailVerifiedAt',
          'firstName',
          'id',
          'isPlatformAdmin',
          'lastLoginAt',
          'lastName',
          'middleName',
          'phoneNumber',
          'status',
          'timezone',
          'updatedAt',
        ].sort(),
      );
    });

    it('requires a session', async () => {
      await getMe(null).expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('changes only the fields sent, trimmed', async () => {
      const cookie = await signIn();
      const before = (await getMe(cookie).expect(200)).body as {
        lastName: string;
        email: string;
      };
      const response = await patchMe(cookie, {
        firstName: '  Adaeze ',
        middleName: '',
        phoneNumber: '+2348012345678',
        timezone: 'Europe/London',
      }).expect(200);

      expect(response.body).toMatchObject({
        firstName: 'Adaeze',
        middleName: '',
        phoneNumber: '+2348012345678',
        timezone: 'Europe/London',
        lastName: before.lastName,
        email: before.email,
      });
      await expect(
        dataSource.getRepository(AppUser).findOneByOrFail({ id: member.userId }),
      ).resolves.toMatchObject({ firstName: 'Adaeze', timezone: 'Europe/London' });
    });

    it('never changes email, status or platform rights, whatever is sent', async () => {
      const cookie = await signIn();
      const before = await dataSource
        .getRepository(AppUser)
        .findOneByOrFail({ id: member.userId });
      await patchMe(cookie, {
        lastName: 'Eze',
        email: 'attacker@example.com',
        status: EUserStatus.INACTIVE,
        isPlatformAdmin: true,
        emailVerifiedAt: null,
      }).expect(200);

      await expect(
        dataSource.getRepository(AppUser).findOneByOrFail({ id: member.userId }),
      ).resolves.toMatchObject({
        lastName: 'Eze',
        email: before.email,
        status: before.status,
        isPlatformAdmin: false,
        emailVerifiedAt: before.emailVerifiedAt,
      });
    });

    it('refuses invalid and empty changes (400)', async () => {
      const cookie = await signIn();
      await patchMe(cookie, { firstName: '' }).expect(400);
      await patchMe(cookie, { timezone: 'Mars/Olympus' }).expect(400);
      await patchMe(cookie, { phoneNumber: '1'.repeat(21) }).expect(400);
      await patchMe(cookie, {}).expect(400);
      // Only unknown fields: stripped, so nothing to change.
      await patchMe(cookie, { email: 'x@example.com' }).expect(400);
    });

    it('requires a session', async () => {
      await patchMe(null, { firstName: 'Ada' }).expect(401);
    });
  });

  describe('POST /users/me/password', () => {
    it('changes the password, signs out other sessions and keeps this one', async () => {
      const current = await signIn();
      const otherDevice = await signIn();
      const before = await storedHash();

      const response = await changePassword(current, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }).expect(200);
      expect(response.body).toEqual({
        message:
          'Your password has been changed. Other devices have been signed out.',
      });

      const after = await storedHash();
      expect(after).not.toBe(before);
      await expect(passwords.verify(NEW_PASSWORD, after)).resolves.toBe(true);
      await expect(passwords.verify(CURRENT_PASSWORD, after)).resolves.toBe(false);
      await getMe(current).expect(200);
      await getMe(otherDevice).expect(401);
    });

    it('refuses a wrong current password with 400 and changes nothing', async () => {
      const current = await signIn();
      const otherDevice = await signIn();
      const before = await storedHash();

      await changePassword(current, {
        currentPassword: 'Wrong-Pass-9',
        newPassword: NEW_PASSWORD,
      }).expect(400);

      expect(await storedHash()).toBe(before);
      await getMe(current).expect(200);
      await getMe(otherDevice).expect(200);
    });

    it('refuses a weak new password and reusing the current one (400)', async () => {
      const current = await signIn();
      await changePassword(current, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: 'weakpassword',
      }).expect(400);
      await changePassword(current, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: CURRENT_PASSWORD,
      }).expect(400);
      await changePassword(current, {}).expect(400);
    });

    it('requires a session', async () => {
      await changePassword(null, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }).expect(401);
    });
  });
});
