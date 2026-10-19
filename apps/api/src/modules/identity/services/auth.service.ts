import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { DataSource, IsNull, Repository } from 'typeorm';
import { EUserStatus } from '@contractflow/contracts-schema';
import { CreateAppUserRequestDto } from '../dto/app-user/requests/create-app-user-request.dto';
import { LoginAppUserDto } from '../dto/app-user/requests/login-app-user-request.dto';
import { AppUser } from '../entities/app-user.entity';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { UserSession } from '../entities/user-session.entity';
import { AppUserResponseDto } from '../dto/app-user/responses/app-user-response.dto';
import { MailService } from '../../mail/mail.service';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'contractflow_session';
const VERIFICATION_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  isPlatformAdmin: boolean;
}

export interface AuthenticatedSession {
  user: AuthenticatedUser;
  sessionId: string;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}

async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, saltHex, keyHex] = encodedHash.split(':');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(keyHex, 'hex');
  if (salt.length !== 16 || expectedKey.length !== 64) return false;

  const actualKey = (await scrypt(
    password,
    salt,
    expectedKey.length,
  )) as Buffer;
  return timingSafeEqual(expectedKey, actualKey);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
  ) {}

  async register(input: CreateAppUserRequestDto): Promise<{ message: string }> {
    const passwordHash = await hashPassword(input.password);
    const rawToken = randomBytes(32).toString('base64url');
    let user: AppUser;

    try {
      user = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(AppUser);
        const created = repository.create({
          email: input.email.trim().toLowerCase(),
          firstName: input.firstName.trim(),
          middleName: input.middleName?.trim() ?? '',
          lastName: input.lastName.trim(),
          phoneNumber: input.phoneNumber.trim(),
          timezone: input.timezone,
          passwordHash,
          status: EUserStatus.ACTIVE,
          isPlatformAdmin: false,
          mfaEnabled: false,
          emailVerifiedAt: null,
          lastLoginAt: null,
        });
        const saved = await repository.save(created);
        const tokenRepository = manager.getRepository(EmailVerificationToken);
        await tokenRepository.save(
          tokenRepository.create({
            userId: saved.id,
            tokenHash: digest(rawToken),
            expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
            usedAt: null,
          }),
        );
        return saved;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw error;
    }

    await this.mailService.sendVerificationEmail(user.email, rawToken);
    return { message: 'Check your email for a verification link.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = digest(token);
    await this.dataSource.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(EmailVerificationToken);
      const record = await tokenRepository.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !record ||
        record.usedAt ||
        record.expiresAt.getTime() <= Date.now()
      ) {
        throw new BadRequestException(
          'This verification link is invalid, expired, or already used.',
        );
      }

      const userRepository = manager.getRepository(AppUser);
      const user = await userRepository.findOne({
        where: { id: record.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.status !== EUserStatus.ACTIVE) {
        throw new BadRequestException('This account cannot be verified.');
      }

      record.usedAt = new Date();
      user.emailVerifiedAt = new Date();
      await tokenRepository.save(record);
      await userRepository.save(user);
    });

    return { message: 'Your email address is verified.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const genericMessage =
      'If an account needs verification, a verification email will be sent.';
    const rawToken = randomBytes(32).toString('base64url');
    const delivery = await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(AppUser).findOne({
        where: { email },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.emailVerifiedAt) return null;

      const tokens = manager.getRepository(EmailVerificationToken);
      const latest = await tokens.findOne({
        where: { userId: user.id },
        order: { createdAt: 'DESC' },
      });
      if (
        latest &&
        Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
      ) {
        return null;
      }

      await tokens.update(
        { userId: user.id, usedAt: IsNull() },
        { usedAt: new Date() },
      );
      await tokens.save(
        tokens.create({
          userId: user.id,
          tokenHash: digest(rawToken),
          expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
          usedAt: null,
        }),
      );
      return user.email;
    });
    if (delivery) {
      await this.mailService.sendVerificationEmail(delivery, rawToken);
    }
    return { message: genericMessage };
  }

  async login(
    input: LoginAppUserDto,
    metadata: RequestMetadata,
  ): Promise<{ user: AppUserResponseDto; cookie: string }> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: input.email })
      .getOne();

    if (
      !user ||
      !(await verifyPassword(input.password, user.passwordHash)) ||
      user.status !== EUserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Verify your email before signing in.');
    }

    const sessionToken = randomBytes(32).toString('base64url');
    const sessionDays = Number(this.config.get('SESSION_TTL_DAYS') ?? 7);
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
    const session = this.sessions.create({
      userId: user.id,
      refreshTokenHash: digest(sessionToken),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt,
      revokedAt: null,
    });
    await this.sessions.save(session);

    user.lastLoginAt = new Date();
    await this.users.save(user);

    const secure =
      this.config.get('NODE_ENV') === 'production' ? '; Secure' : '';
    const cookie = `${SESSION_COOKIE}=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}${secure}`;
    return { user: AppUserResponseDto.fromEntity(user), cookie };
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    const session = await this.sessions.findOne({
      where: {
        refreshTokenHash: digest(sessionToken),
        revokedAt: IsNull(),
      },
    });
    if (!session) return;
    session.revokedAt = new Date();
    await this.sessions.save(session);
  }

  async authenticate(sessionToken: string): Promise<AuthenticatedSession> {
    const session = await this.sessions.findOne({
      where: {
        refreshTokenHash: digest(sessionToken),
        revokedAt: IsNull(),
      },
      relations: { user: true },
    });
    if (
      !session ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== EUserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Authentication required.');
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        emailVerifiedAt: session.user.emailVerifiedAt,
        isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
      },
      sessionId: session.id,
    };
  }

  sessionCookieName(): string {
    return SESSION_COOKIE;
  }

  clearSessionCookie(): string {
    const secure =
      this.config.get('NODE_ENV') === 'production' ? '; Secure' : '';
    return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
  }
}
