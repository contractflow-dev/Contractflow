import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly sesClient: SESClient;

  constructor(private readonly config: ConfigService) {
    this.sesClient = new SESClient({
      region: this.config.get<string>('AWS_REGION') ?? 'eu-north-1',
    });
  }

  async sendVerificationEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');

    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const verificationUrl = new URL('/auth/verify-email', webUrl);
    verificationUrl.searchParams.set('token', token);

    const text =
      `Verify your email address by opening this link: ${verificationUrl.toString()}\n\n` +
      'This link expires in 30 minutes and can only be used once.';

    await this.sendEmail(
      email,
      'Verify your ContractFlow email',
      text,
    );
  }

  async sendCompanyInvitationEmail(
    email: string,
    companyName: string,
    role: string,
    token: string,
  ): Promise<void> {
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');

    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const invitationUrl = new URL('/invitations/respond', webUrl);
    invitationUrl.searchParams.set('token', token);

    const text =
      `Hello,\n\n` +
      `You have been invited to join ${companyName} on ContractFlow as ${role}.\n\n` +
      `Sign in or create an account using this email address, then review the invitation here: ${invitationUrl.toString()}\n\n` +
      'This invitation expires in 7 days and can only be used once.';

    await this.sendEmail(
      email,
      `Invitation to join ${companyName}`,
      text,
    );
  }

  async sendContractRoleInvitationEmail(
    email: string,
    contractTitle: string,
    role: string,
    workspace: string,
    token: string,
  ): Promise<void> {
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');

    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const invitationUrl = new URL(
      '/invitations/contract-role',
      webUrl,
    );
    invitationUrl.searchParams.set('token', token);

    const text =
      `You have been invited to join the ${workspace} workspace for ${contractTitle} on ContractFlow as ${role}.\n\n` +
      `Sign in using the invited email address to accept or decline: ${invitationUrl.toString()}\n\n` +
      'This invitation expires in 7 days and can only be used once.';

    await this.sendEmail(
      email,
      `Contract role invitation for ${contractTitle}`,
      text,
    );
  }

  async sendContractPartyInvitationEmail(
    email: string,
    contractTitle: string,
    invitingCompanyName: string,
    partyType: string,
    token: string,
  ): Promise<void> {
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');

    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const invitationUrl = new URL(
      '/invitations/contract-party',
      webUrl,
    );
    invitationUrl.searchParams.set('token', token);

    const text =
      `${invitingCompanyName} invited your verified company to join ${contractTitle} as ${partyType} on ContractFlow.\n\n` +
      `A Company Administrator can sign in and review the invitation here: ${invitationUrl.toString()}\n\n` +
      'This invitation expires in 7 days and can only be used once.';

    await this.sendEmail(
      email,
      `Contract invitation for ${contractTitle}`,
      text,
    );
  }

  private async sendEmail(
    email: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    const provider =
      this.config.get<string>('MAIL_PROVIDER') ??
      (isProduction ? 'ses' : 'smtp');

    if (provider === 'smtp') {
      await this.sendSmtpEmail(email, subject, text);
      return;
    }

    if (provider === 'ses') {
      await this.sendSesEmail(email, subject, text);
      return;
    }

    if (provider === 'resend') {
      await this.sendResendEmail(email, subject, text);
      return;
    }

    throw new ServiceUnavailableException(
      'Unsupported mail provider. Set MAIL_PROVIDER to "smtp", "ses", or "resend".',
    );
  }

  private async sendSesEmail(
    email: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const from =
      this.config.get<string>('SES_FROM_EMAIL') ??
      this.config.get<string>('EMAIL_FROM');

    if (!from) {
      throw new ServiceUnavailableException(
        'SES delivery is not configured. Set SES_FROM_EMAIL.',
      );
    }

    const command = new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: text,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      await this.sesClient.send(command);
    } catch (error) {
      this.logger.error(
        `SES send failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      throw new ServiceUnavailableException(
        'The email could not be delivered through Amazon SES. Please try again later.',
        { cause: error },
      );
    }
  }

  private async sendResendEmail(
    email: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const apiKey =
      this.config.get<string>('RESEND_API_KEY');

    const from =
      this.config.get<string>('EMAIL_FROM');

    if (!apiKey || !from) {
      throw new ServiceUnavailableException(
        'Resend delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.',
      );
    }

    let response: Response;

    try {
      response = await fetch(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [email],
            subject,
            text,
          }),
        },
      );
    } catch (error) {
      this.logger.error(
        `Resend send failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      throw new ServiceUnavailableException(
        'The email could not be delivered through Resend. Please try again later.',
        { cause: error },
      );
    }

    if (!response.ok) {
      const responseText = await response
        .text()
        .catch(() => '');

      this.logger.error(
        `Resend send failed with status ${response.status}: ${responseText}`,
      );

      throw new ServiceUnavailableException(
        'The email could not be delivered through Resend. Please try again later.',
      );
    }
  }

  private async sendSmtpEmail(
    email: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const host =
      this.config.get<string>('SMTP_HOST') ??
      'localhost';

    const port = Number(
      this.config.get<string>('SMTP_PORT') ?? '1025',
    );

    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new ServiceUnavailableException(
        'Invalid SMTP_PORT. Set it to a port between 1 and 65535.',
      );
    }

    const user =
      this.config.get<string>('SMTP_USER');

    const pass =
      this.config.get<string>('SMTP_PASS');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure:
        this.config.get<string>('SMTP_SECURE') ===
        'true',
      ...(user && pass
        ? {
            auth: {
              user,
              pass,
            },
          }
        : {}),
    });

    try {
      await transporter.sendMail({
        from:
          this.config.get<string>('EMAIL_FROM') ??
          'ContractFlow <no-reply@contractflow.local>',
        to: email,
        subject,
        text,
      });
    } catch (error) {
      this.logger.error(
        `SMTP send failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      throw new ServiceUnavailableException(
        'The email could not be delivered through SMTP. Please try again later.',
        { cause: error },
      );
    }
  }
}