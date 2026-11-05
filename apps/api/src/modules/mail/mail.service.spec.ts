import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  smtpOptions: [] as unknown[],
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (options: unknown) => {
      mocks.smtpOptions.push(options);
      return { sendMail: mocks.sendMail };
    },
  },
}));

function createService(values: Record<string, string>) {
  const config = {
    get: (key: string) => values[key],
  };
  return new MailService(config as ConfigService);
}

describe('MailService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.sendMail.mockReset();
    mocks.smtpOptions.length = 0;
  });

  it('sends verification email through local SMTP by default', async () => {
    const service = createService({
      NODE_ENV: 'development',
    });

    await service.sendVerificationEmail('user@example.com', 'verify-token');

    expect(mocks.smtpOptions).toEqual([
      {
        host: 'localhost',
        port: 1025,
        secure: false,
      },
    ]);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'ContractFlow <no-reply@contractflow.local>',
        to: 'user@example.com',
        subject: 'Verify your ContractFlow email',
        text: expect.stringContaining(
          'http://localhost:3000/auth/verify-email?token=verify-token',
        ),
      }),
    );
  });

  it('keeps Resend as the production default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const service = createService({
      NODE_ENV: 'production',
      RESEND_API_KEY: 'test-api-key',
      EMAIL_FROM: 'ContractFlow <verified@example.com>',
      WEB_URL: 'https://contractflow.example.com',
    });

    await service.sendVerificationEmail('user@example.com', 'verify-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(
          'https://contractflow.example.com/auth/verify-email?token=verify-token',
        ),
      }),
    );
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it('sends company invitations through the configured local SMTP server', async () => {
    const service = createService({
      NODE_ENV: 'development',
    });

    await service.sendCompanyInvitationEmail(
      'member@example.com',
      'Example Energy',
      'Finance Officer',
      'single-use-token',
    );

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'member@example.com',
        subject: 'Invitation to join Example Energy',
        text: expect.stringContaining(
          'http://localhost:3000/invitations/respond?token=single-use-token',
        ),
      }),
    );
    expect(mocks.sendMail.mock.calls[0][0].text).toContain('Hello,');
  });

  it('reports SMTP invitation delivery failures to the calling transaction', async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error('SMTP offline'));
    const service = createService({ NODE_ENV: 'development' });

    await expect(
      service.sendCompanyInvitationEmail(
        'member@example.com',
        'Example Energy',
        'Finance Officer',
        'single-use-token',
      ),
    ).rejects.toThrow('could not be delivered through SMTP');
  });
});
