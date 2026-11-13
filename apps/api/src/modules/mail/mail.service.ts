import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { renderEmail } from './email.template';

const INVITATION_SECURITY_NOTICE =
  "If you weren't expecting this invitation, you can ignore this email. " +
  'Nothing changes unless you sign in and accept it.';

const WORKSPACE_LABELS: Readonly<Record<string, string>> = {
  project: 'Project',
  hse: 'HSE',
  finance: 'Finance',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
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
    const { text, html } = renderEmail({
      heading: 'Verify your email address',
      intro:
        'Confirm your email address to finish setting up your ContractFlow account.',
      ctaLabel: 'Verify Email Address',
      url: verificationUrl.toString(),
      expiryNotice:
        'This link expires in 30 minutes and can only be used once.',
      securityNotice:
        "If you didn't create a ContractFlow account, you can ignore this email.",
    });
    await this.sendEmail(email, 'Verify your ContractFlow email', text, html);
  }

  /**
   * The password reset link. The token is only ever in this email's link:
   * never logged, and the email loads no images or remote content and has no
   * tracking links.
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');
    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const resetUrl = new URL('/auth/reset-password', webUrl);
    resetUrl.searchParams.set('token', token);
    const { text, html } = renderEmail({
      heading: 'Reset your password',
      intro:
        'We received a request to reset the password for your ContractFlow account.',
      instructions:
        'Choose a new password using the link below. Resetting your password signs you out on every device.',
      ctaLabel: 'Reset Password',
      url: resetUrl.toString(),
      expiryNotice: `This link expires in ${expiresInMinutes} minutes and can only be used once.`,
      securityNotice:
        "If you didn't ask to reset your password, you can ignore this email. Your password stays the same.",
    });
    await this.sendEmail(email, 'Reset your ContractFlow password', text, html);
  }

  async sendCompanyInvitationEmail(
    email: string,
    companyName: string,
    role: string,
    token: string,
  ): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
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
    const { text, html } = renderEmail({
      heading: `You're invited to join ${companyName}`,
      greeting: 'Hello,',
      intro: `You have been invited to join ${companyName} on ContractFlow as ${role}.`,
      details: [
        { label: 'Company', value: companyName },
        { label: 'Role', value: role },
      ],
      instructions:
        'Sign in or create an account using this email address, then review the invitation to accept or decline it.',
      ctaLabel: 'Review Invitation',
      url: invitationUrl.toString(),
      expiryNotice:
        'This invitation expires in 7 days and can only be used once.',
      securityNotice: INVITATION_SECURITY_NOTICE,
    });
    await this.sendEmail(
      email,
      `Invitation to join ${companyName}`,
      text,
      html,
    );
  }

  async sendContractRoleInvitationEmail(
    email: string,
    contractTitle: string,
    role: string,
    workspace: string,
    token: string,
    invitingCompanyName?: string,
  ): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');
    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const invitationUrl = new URL('/invitations/contract-role', webUrl);
    invitationUrl.searchParams.set('token', token);
    const workspaceName = WORKSPACE_LABELS[workspace] ?? workspace;
    const { text, html } = renderEmail({
      heading: `You're invited to work on ${contractTitle}`,
      intro: `You have been invited to join the ${workspaceName} workspace for ${contractTitle} on ContractFlow as ${role}.`,
      details: [
        { label: 'Contract', value: contractTitle },
        ...(invitingCompanyName
          ? [{ label: 'Invited by', value: invitingCompanyName }]
          : []),
        { label: 'Workspace', value: workspaceName },
        { label: 'Contract role', value: role },
      ],
      instructions:
        'Sign in using the invited email address, then review the invitation to accept or decline it.',
      ctaLabel: 'Review Contract Invitation',
      url: invitationUrl.toString(),
      expiryNotice:
        'This invitation expires in 7 days and can only be used once.',
      securityNotice: INVITATION_SECURITY_NOTICE,
    });
    await this.sendEmail(
      email,
      `Contract role invitation for ${contractTitle}`,
      text,
      html,
    );
  }

  async sendCompanyVerificationEmail(
    email: string,
    companyName: string,
    token: string,
  ): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');
    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const verificationUrl = new URL('/auth/verify-company', webUrl);
    verificationUrl.searchParams.set('token', token);
    const { text, html } = renderEmail({
      heading: 'Verify your company email',
      intro: `Confirm that ${email} is the company email for ${companyName} on ContractFlow.`,
      details: [
        { label: 'Company', value: companyName },
        { label: 'Company email', value: email },
      ],
      instructions:
        'Other companies can only invite a verified company to their contracts.',
      ctaLabel: 'Verify Company Email',
      url: verificationUrl.toString(),
      expiryNotice: 'This link expires in 7 days and can only be used once.',
      securityNotice:
        "If you don't manage this company on ContractFlow, you can ignore this email. The company email stays unverified.",
    });
    await this.sendEmail(
      email,
      `Verify the company email for ${companyName}`,
      text,
      html,
    );
  }

  async sendContractPartyInvitationEmail(
    email: string,
    contractTitle: string,
    invitingCompanyName: string,
    partyType: string,
    token: string,
  ): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const webUrl =
      this.config.get<string>('WEB_URL') ??
      (isProduction ? undefined : 'http://localhost:3000');
    if (!webUrl) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set WEB_URL.',
      );
    }

    const invitationUrl = new URL('/invitations/contract-party', webUrl);
    invitationUrl.searchParams.set('token', token);
    const partyTypeName =
      partyType.charAt(0).toUpperCase() + partyType.slice(1);
    const { text, html } = renderEmail({
      heading: `Your company is invited to join ${contractTitle}`,
      intro: `${invitingCompanyName} invited your verified company to join ${contractTitle} as ${partyType} on ContractFlow.`,
      details: [
        { label: 'Contract', value: contractTitle },
        { label: 'Invited by', value: invitingCompanyName },
        { label: 'Party type', value: partyTypeName },
      ],
      instructions:
        'A Company Administrator can sign in and review the invitation to accept or reject it.',
      ctaLabel: 'Review Contract Invitation',
      url: invitationUrl.toString(),
      expiryNotice:
        'This invitation expires in 7 days and can only be used once.',
      securityNotice: INVITATION_SECURITY_NOTICE,
    });
    await this.sendEmail(
      email,
      `Contract invitation for ${contractTitle}`,
      text,
      html,
    );
  }

  private async sendEmail(
    email: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const provider =
      this.config.get<string>('MAIL_PROVIDER') ??
      (isProduction ? 'resend' : 'smtp');

    if (provider === 'smtp') {
      await this.sendSmtpEmail(email, subject, text, html);
      return;
    }

    if (provider !== 'resend') {
      throw new ServiceUnavailableException(
        'Unsupported mail provider. Set MAIL_PROVIDER to "smtp" or "resend".',
      );
    }

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    if (!apiKey || !from) {
      throw new ServiceUnavailableException(
        'Resend delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.',
      );
    }

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
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
          ...(html ? { html } : {}),
        }),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'The verification email could not be delivered. Please try again later.',
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'The verification email could not be delivered. Please try again later.',
      );
    }
  }

  private async sendSmtpEmail(
    email: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '1025');
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException(
        'Invalid SMTP_PORT. Set it to a port between 1 and 65535.',
      );
    }

    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    try {
      await transporter.sendMail({
        from:
          this.config.get<string>('EMAIL_FROM') ??
          'ContractFlow <no-reply@contractflow.local>',
        to: email,
        subject,
        text,
        ...(html ? { html } : {}),
      });
    } catch (error) {
      // NEW: log the real SMTP error so it shows up in Render Logs
      this.logger.error(
        `SMTP send failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'The verification email could not be delivered through SMTP. Please try again later.',
        { cause: error },
      );
    }
  }
}
