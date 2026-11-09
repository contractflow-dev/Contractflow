import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { EUserStatus } from '@contractflow/contracts-schema';
import type { AppUser } from '../../entities/app-user.entity';
import { MailService } from '../../../mail/mail.service';
import {
  PASSWORD_RESET_UNIT_OF_WORK,
  type IPasswordResetUnitOfWork,
} from '../../interface/password-reset-persistence.interface';
import { PasswordService } from './password.service';

/** How long a reset link works. */
export const RESET_TOKEN_TTL_MINUTES = 30;
/** At most one reset email per account in this window. */
export const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
/** And at most this many per account per hour. */
export const RESET_REQUESTS_PER_HOUR = 5;

export const GENERIC_RESET_REQUEST_MESSAGE =
  'If an account exists for this email address, password reset instructions will be sent.';
export const RESET_LINK_INVALID_MESSAGE =
  'This password reset link is invalid, expired, or already used.';
export const PASSWORD_RESET_MESSAGE =
  'Your password has been reset. Sign in with your new password.';

const HOUR_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Only an active, verified account can reset its password by email. */
function canResetPassword(user: AppUser | null): user is AppUser {
  return Boolean(
    user && user.status === EUserStatus.ACTIVE && user.emailVerifiedAt,
  );
}

/**
 * Forgotten-password recovery: a single-use, short-lived emailed link that
 * sets a new password and signs the account out everywhere.
 *
 * Every request for a link gets the same answer, whether or not the address
 * has an account, may reset, or has hit its rate limit, and the email is
 * sent after the response so its timing doesn't tell either.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject(PASSWORD_RESET_UNIT_OF_WORK)
    private readonly unitOfWork: IPasswordResetUnitOfWork,
    private readonly mailService: MailService,
    private readonly passwordService: PasswordService,
  ) {}

  async requestReset(email: string): Promise<{ message: string }> {
    const rawToken = randomBytes(32).toString('base64url');
    const issued = await this.unitOfWork.execute(
      async ({ users, resetTokens }) => {
        // Locks the user row, so concurrent requests are rate limited in turn.
        const user = await users.findByEmailForUpdate(email);
        if (!canResetPassword(user)) return null;

        const now = new Date();
        const latest = await resetTokens.findLatestForUser(user.id);
        if (
          latest &&
          now.getTime() - latest.createdAt.getTime() < RESET_REQUEST_COOLDOWN_MS
        ) {
          return null;
        }
        const recent = await resetTokens.countCreatedSince(
          user.id,
          new Date(now.getTime() - HOUR_MS),
        );
        if (recent >= RESET_REQUESTS_PER_HOUR) return null;

        // Only the newest link works.
        await resetTokens.invalidateUnusedForUser(user.id, now);
        const token = await resetTokens.saveToken(
          resetTokens.createToken({
            userId: user.id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(
              now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
            ),
            usedAt: null,
          }),
        );
        return { userId: user.id, email: user.email, tokenId: token.id };
      },
    );

    if (issued) {
      // Not awaited: the response must not take longer for real accounts.
      void this.deliver(issued, rawToken);
    }
    return { message: GENERIC_RESET_REQUEST_MESSAGE };
  }

  /**
   * Sends the link. If sending fails, the token is voided, so no link that
   * never arrived stays usable; the user can simply ask again.
   */
  async deliver(
    issued: { userId: string; email: string; tokenId: string },
    rawToken: string,
  ): Promise<void> {
    try {
      await this.mailService.sendPasswordResetEmail(
        issued.email,
        rawToken,
        RESET_TOKEN_TTL_MINUTES,
      );
    } catch (error) {
      // Never log the token or the address.
      this.logger.error(
        `Password reset email for user ${issued.userId} could not be sent: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      try {
        await this.unitOfWork.execute(({ resetTokens }) =>
          resetTokens.consume(issued.tokenId, new Date()),
        );
      } catch (voidError) {
        this.logger.error(
          `Unsent password reset token for user ${issued.userId} could not be voided; it expires in ${RESET_TOKEN_TTL_MINUTES} minutes: ${
            voidError instanceof Error ? voidError.message : String(voidError)
          }`,
        );
      }
    }
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    // Hashing is slow, so it happens before the transaction takes any locks.
    const passwordHash = await this.passwordService.hash(password);

    await this.unitOfWork.execute(async ({ users, resetTokens, sessions }) => {
      const now = new Date();
      // The row lock makes a concurrent request with the same token wait,
      // then find it used.
      const record = await resetTokens.findByHashForUpdate(hashToken(token));
      if (
        !record ||
        record.usedAt ||
        record.expiresAt.getTime() <= now.getTime()
      ) {
        throw new BadRequestException(RESET_LINK_INVALID_MESSAGE);
      }

      const user = await users.findByIdForUpdate(record.userId);
      if (!canResetPassword(user)) {
        throw new BadRequestException(RESET_LINK_INVALID_MESSAGE);
      }

      // Conditional in the database as well as checked above.
      if (!(await resetTokens.consume(record.id, now))) {
        throw new BadRequestException(RESET_LINK_INVALID_MESSAGE);
      }
      await resetTokens.invalidateUnusedForUser(user.id, now);
      await users.updatePasswordHash(user.id, passwordHash);
      // Signed out everywhere: a stolen session doesn't survive the reset.
      await sessions.revokeAllActiveForUser(user.id, now);
    });

    return { message: PASSWORD_RESET_MESSAGE };
  }
}
