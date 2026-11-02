import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EUserStatus } from '@contractflow/contracts-schema';
import { AppUserResponseDto } from '../../dto/app-user/responses/app-user-response.dto';
import { CreateAppUserRequestDto } from '../../dto/app-user/requests/create-app-user-request.dto';
import { LoginAppUserDto } from '../../dto/app-user/requests/login-app-user-request.dto';
import { AppUser } from '../../entities/app-user.entity';
import { MailService } from '../../../mail/mail.service';
import type {
  AuthenticatedSession,
  RequestMetadata,
} from '../../interface/auth-context.interface';
import type { AuthLoginResult } from '../../interface/auth-login-result.interface';
import { AppUserRepository } from '../../repositories/app-user.repository';
import { EmailVerificationTokenRepository } from '../../repositories/email-verification-token.repository';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const SESSION_COOKIE = 'contractflow_session';
const VERIFICATION_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const GENERIC_RESEND_MESSAGE =
  'If an account needs verification, a verification email will be sent.';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return (
    'driverError' in error && isUniqueConstraintViolation(error.driverError)
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly appUserRepository: AppUserRepository,
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  async register(input: CreateAppUserRequestDto): Promise<{ message: string }> {
    const rawToken = randomBytes(32).toString('base64url');
    const passwordHash = await this.passwordService.hash(input.password);
    let user: AppUser;

    try {
      user = await this.dataSource.transaction(async (manager) => {
        const created = this.appUserRepository.createInTransaction(manager, {
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
        const savedUser = await this.appUserRepository.saveInTransaction(
          manager,
          created,
        );

        await this.emailVerificationTokenRepository.saveInTransaction(
          manager,
          this.emailVerificationTokenRepository.createInTransaction(manager, {
            userId: savedUser.id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
            usedAt: null,
          }),
        );

        return savedUser;
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
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
    await this.dataSource.transaction(async (manager) => {
      const record =
        await this.emailVerificationTokenRepository.findByHashForUpdate(
          manager,
          hashToken(token),
        );

      if (
        !record ||
        record.usedAt ||
        record.expiresAt.getTime() <= Date.now()
      ) {
        throw new BadRequestException(
          'This verification link is invalid, expired, or already used.',
        );
      }

      const user = await this.appUserRepository.findByIdForUpdate(
        manager,
        record.userId,
      );
      if (!user || user.status !== EUserStatus.ACTIVE) {
        throw new BadRequestException('This account cannot be verified.');
      }

      const verifiedAt = new Date();
      record.usedAt = verifiedAt;
      user.emailVerifiedAt = verifiedAt;
      await this.emailVerificationTokenRepository.saveInTransaction(
        manager,
        record,
      );
      await this.appUserRepository.saveInTransaction(manager, user);
    });

    return { message: 'Your email address is verified.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const rawToken = randomBytes(32).toString('base64url');
    const deliveryEmail = await this.dataSource.transaction(async (manager) => {
      const user = await this.appUserRepository.findByEmailForUpdate(
        manager,
        email,
      );
      if (!user || user.status !== EUserStatus.ACTIVE || user.emailVerifiedAt) {
        return null;
      }

      const latest =
        await this.emailVerificationTokenRepository.findLatestForUser(
          manager,
          user.id,
        );
      if (
        latest &&
        Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
      ) {
        return null;
      }

      const now = new Date();
      await this.emailVerificationTokenRepository.invalidateUnusedForUser(
        manager,
        user.id,
        now,
      );
      await this.emailVerificationTokenRepository.saveInTransaction(
        manager,
        this.emailVerificationTokenRepository.createInTransaction(manager, {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
          usedAt: null,
        }),
      );
      return user.email;
    });

    if (deliveryEmail) {
      await this.mailService.sendVerificationEmail(deliveryEmail, rawToken);
    }
    return { message: GENERIC_RESEND_MESSAGE };
  }

  async login(
    input: LoginAppUserDto,
    metadata: RequestMetadata,
  ): Promise<AuthLoginResult> {
    const user = await this.appUserRepository.findByEmailWithPassword(
      input.email,
    );
    if (
      !user ||
      user.status !== EUserStatus.ACTIVE ||
      !(await this.passwordService.verify(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Verify your email before signing in.');
    }

    const sessionDays = Number(
      this.config.get<string | number>('SESSION_TTL_DAYS') ?? 7,
    );
    const { sessionToken, expiresAt } = await this.sessionService.createSession(
      user,
      metadata,
      sessionDays,
    );
    user.lastLoginAt = new Date();
    await this.appUserRepository.updateLastLogin(user.id, user.lastLoginAt);

    return {
      user: AppUserResponseDto.fromEntity(user),
      sessionToken,
      expiresAt,
    };
  }

  logout(sessionToken: string | undefined): Promise<void> {
    return this.sessionService.revokeSession(sessionToken);
  }

  authenticate(sessionToken: string): Promise<AuthenticatedSession> {
    return this.sessionService.authenticate(sessionToken);
  }

  sessionCookieName(): string {
    return SESSION_COOKIE;
  }
}
