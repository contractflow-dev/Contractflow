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
});
