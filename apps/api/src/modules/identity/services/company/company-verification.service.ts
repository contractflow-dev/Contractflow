import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ECompanyStatus } from '@contractflow/contracts-schema';
import { MailService } from '../../../mail/mail.service';
import {
  COMPANY_VERIFICATION_UNIT_OF_WORK,
  type ICompanyVerificationContext,
  type ICompanyVerificationUnitOfWork,
} from '../../interface/company-verification-persistence.interface';

export const COMPANY_VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

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

/**
 * Proves a company controls its company email. Contract party invitations are
 * matched to companies by that email, so only verified companies receive them.
 */
@Injectable()
export class CompanyVerificationService {
  private readonly logger = new Logger(CompanyVerificationService.name);

  constructor(
    @Inject(COMPANY_VERIFICATION_UNIT_OF_WORK)
    private readonly unitOfWork: ICompanyVerificationUnitOfWork,
    private readonly mail: MailService,
  ) {}

  /**
   * Sends a fresh link after a company is created or its email changes. A
   * delivery failure is logged rather than thrown: the company change has
   * already been saved, and an administrator can resend the link.
   */
  async sendAfterEmailChange(companyId: string): Promise<void> {
    try {
      await this.issueAndSend(companyId, false);
    } catch (error) {
      this.logger.warn(
        `Company verification email could not be sent for ${companyId}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async resend(
    userId: string,
    companyId: string,
  ): Promise<{ message: string }> {
    await this.issueAndSend(companyId, true, userId);
    return { message: 'A verification link was sent to the company email.' };
  }

  async verify(token: string): Promise<{ message: string; companyName: string }> {
    try {
      return await this.unitOfWork.execute(async (context) => {
        const record = await context.findTokenByHashForUpdate(hashToken(token));
        if (
          !record ||
          record.usedAt ||
          record.expiresAt.getTime() <= Date.now()
        ) {
          throw new BadRequestException(
            'This verification link is invalid, expired, or already used.',
          );
        }

        const company = await context.findCompanyForUpdate(record.companyId);
        if (!company || company.status !== ECompanyStatus.ACTIVE) {
          throw new BadRequestException('This company cannot be verified.');
        }
        // The email changed after this link was sent.
        if (company.email.toLowerCase() !== record.email.toLowerCase()) {
          throw new BadRequestException(
            'This verification link is invalid, expired, or already used.',
          );
        }

        const now = new Date();
        record.usedAt = now;
        await context.saveToken(record);
        if (!company.verifiedAt) {
          await this.assertEmailAvailable(context, company.email, company.id);
          company.verifiedAt = now;
          await context.saveCompany(company);
        }
        return {
          message: 'Your company email is verified.',
          companyName: company.name,
        };
      });
    } catch (error) {
      // Two companies verifying the same email at once.
      if (isUniqueConstraintViolation(error)) throw this.emailTakenError();
      throw error;
    }
  }

  private async issueAndSend(
    companyId: string,
    enforceCooldown: boolean,
    requestedByUserId?: string,
  ): Promise<void> {
    const rawToken = randomBytes(32).toString('base64url');
    const delivery = await this.unitOfWork.execute(async (context) => {
      if (
        requestedByUserId !== undefined &&
        !(await context.isActiveCompanyAdmin(requestedByUserId, companyId))
      ) {
        throw new ForbiddenException(
          'Only company administrators can verify the company email.',
        );
      }

      const company = await context.findCompanyForUpdate(companyId);
      if (!company || company.status !== ECompanyStatus.ACTIVE) {
        throw new NotFoundException('Company was not found.');
      }
      if (company.verifiedAt) {
        if (enforceCooldown) {
          throw new ConflictException('The company email is already verified.');
        }
        return null;
      }
      if (enforceCooldown) {
        await this.assertEmailAvailable(context, company.email, company.id);
        const latest = await context.findLatestToken(company.id);
        if (
          latest &&
          Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
        ) {
          throw new HttpException(
            'A verification link was sent recently. Please wait a minute before requesting another.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      const now = new Date();
      await context.invalidateUnusedTokens(company.id, now);
      await context.createToken({
        companyId: company.id,
        email: company.email,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + COMPANY_VERIFICATION_TTL_MS),
        usedAt: null,
      });
      return { email: company.email, name: company.name };
    });

    if (delivery) {
      await this.mail.sendCompanyVerificationEmail(
        delivery.email,
        delivery.name,
        rawToken,
      );
    }
  }

  private async assertEmailAvailable(
    context: ICompanyVerificationContext,
    email: string,
    companyId: string,
  ): Promise<void> {
    if (await context.findOtherVerifiedCompanyByEmail(email, companyId)) {
      throw this.emailTakenError();
    }
  }

  private emailTakenError(): ConflictException {
    return new ConflictException(
      'Another company has already verified this email address. Use a different company email.',
    );
  }
}
