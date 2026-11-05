import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import { EUserStatus } from '@contractflow/contracts-schema';
import type { IUnitOfWork } from '../../../../common/application/unit-of-work.interface';
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
import {
  APP_USER_REPOSITORY,
  AUTH_UNIT_OF_WORK,
  type IAppUserRepository,
  type IAuthTransactionContext,
} from '../../interface/auth-persistence.interface';
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
    @Inject(AUTH_UNIT_OF_WORK)
    private readonly unitOfWork: IUnitOfWork<IAuthTransactionContext>,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    @Inject(APP_USER_REPOSITORY)
    private readonly appUserRepository: IAppUserRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  async register(input: CreateAppUserRequestDto): Promise<{ message: string }> {
    const rawToken = randomBytes(32).toString('base64url');
    const passwordHash = await this.passwordService.hash(input.password);
    let user: AppUser;

    try {
      user = await this.unitOfWork.execute(
        async ({ users, verificationTokens }) => {
          const created = users.createUser({
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
          const savedUser = await users.saveUser(created);

          await verificationTokens.saveToken(
            verificationTokens.createToken({
              userId: savedUser.id,
              tokenHash: hashToken(rawToken),
              expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
              usedAt: null,
            }),
          );

          return savedUser;
        },
      );
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
    await this.unitOfWork.execute(async ({ users, verificationTokens }) => {
      const record = await verificationTokens.findByHashForUpdate(
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

      const user = await users.findByIdForUpdate(record.userId);
      if (!user || user.status !== EUserStatus.ACTIVE) {
        throw new BadRequestException('This account cannot be verified.');
      }

      const verifiedAt = new Date();
      record.usedAt = verifiedAt;
      user.emailVerifiedAt = verifiedAt;
      await verificationTokens.saveToken(record);
      await users.saveUser(user);
    });

    return { message: 'Your email address is verified.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const rawToken = randomBytes(32).toString('base64url');
    const deliveryEmail = await this.unitOfWork.execute(
      async ({ users, verificationTokens }) => {
        const user = await users.findByEmailForUpdate(email);
        if (
          !user ||
          user.status !== EUserStatus.ACTIVE ||
          user.emailVerifiedAt
        ) {
          return null;
        }

        const latest = await verificationTokens.findLatestForUser(user.id);
        if (
          latest &&
          Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
        ) {
          return null;
        }

        const now = new Date();
        await verificationTokens.invalidateUnusedForUser(user.id, now);
        await verificationTokens.saveToken(
          verificationTokens.createToken({
            userId: user.id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
            usedAt: null,
          }),
        );
        return user.email;
      },
    );

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
