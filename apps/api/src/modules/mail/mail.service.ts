import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
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
    const text = `Verify your email address by opening this link: ${verificationUrl.toString()}\n\nThis link expires in 30 minutes and can only be used once.`;
    const provider =
      this.config.get<string>('MAIL_PROVIDER') ??
      (isProduction ? 'resend' : 'smtp');

    if (provider === 'smtp') {
      await this.sendSmtpEmail(email, text);
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
          subject: 'Verify your ContractFlow email',
          text,
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

  private async sendSmtpEmail(email: string, text: string): Promise<void> {
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
        subject: 'Verify your ContractFlow email',
        text,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'The verification email could not be delivered through SMTP. Please try again later.',
        { cause: error },
      );
    }
  }
}
