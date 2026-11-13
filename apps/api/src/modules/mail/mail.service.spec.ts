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

  it('sends a password reset link with its expiry and an ignore note', async () => {
    const service = createService({
      NODE_ENV: 'development',
      WEB_URL: 'http://localhost:3202',
    });

    await service.sendPasswordResetEmail('user@example.com', 'reset-token', 30);

    const url = 'http://localhost:3202/auth/reset-password?token=reset-token';
    const message = sentMessage();
    expect(message.to).toBe('user@example.com');
    expect(message.subject).toBe('Reset your ContractFlow password');
    expect(message.text).toContain(`Reset Password: ${url}`);
    expect(message.text).toContain('expires in 30 minutes');
    expect(message.text).toContain('signs you out on every device');
    expect(message.text).toContain("If you didn't ask to reset your password");
    expect(message.text.match(/https?:\/\//g)).toHaveLength(1);
    // No images, remote content or tracking links that could see the token:
    // the only URLs in the HTML are the reset link itself.
    expect(message.html).toContain('>Reset Password</a>');
    expect(linksIn(message.html)).toEqual([url, url]);
    // Button link, fallback link and the fallback link's visible text.
    expect(message.html?.match(/https?:\/\/[^"<\s]*/g)).toEqual([
      url,
      url,
      url,
    ]);
    expect(message.html).not.toMatch(/<img|<link|<script|src=|url\(/i);
  });

  it('sends account verification as HTML with a verify button and plain text', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendVerificationEmail('user@example.com', 'verify-token');

    const url = 'http://localhost:3000/auth/verify-email?token=verify-token';
    const { subject, text, html } = sentMessage();
    expect(subject).toBe('Verify your ContractFlow email');
    expect(html).toContain('>Verify Email Address</a>');
    expect(linksIn(html)).toEqual([url, url]);
    expect(html).toContain('expires in 30 minutes');
    expect(html).toContain('If you didn&#39;t create a ContractFlow account');
    expect(text).toContain(`Verify Email Address: ${url}`);
    expect(text).toContain('expires in 30 minutes');
    expect(text).toContain("If you didn't create a ContractFlow account");
  });

  it('sends company email verification with the company details', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendCompanyVerificationEmail(
      'admin@energy.example',
      'Example <Energy>',
      'company-token',
    );

    const url = 'http://localhost:3000/auth/verify-company?token=company-token';
    const { subject, text, html } = sentMessage();
    expect(subject).toBe('Verify the company email for Example <Energy>');
    expect(html).toContain('>Verify Company Email</a>');
    expect(linksIn(html)).toEqual([url, url]);
    expect(html).toContain('Example &lt;Energy&gt;');
    expect(html).not.toContain('<Energy>');
    expect(text).toContain('Company: Example <Energy>');
    expect(text).toContain('Company email: admin@energy.example');
    expect(text).toContain(
      'Other companies can only invite a verified company',
    );
    expect(text).toContain('expires in 7 days');
    expect(text).toContain(`Verify Company Email: ${url}`);
  });

  it('refuses to build a reset link without a web URL in production', async () => {
    const service = createService({ NODE_ENV: 'production' });

    await expect(
      service.sendPasswordResetEmail('user@example.com', 'reset-token', 30),
    ).rejects.toThrow('Set WEB_URL');
    expect(mocks.sendMail).not.toHaveBeenCalled();
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

  type SentMessage = {
    to: string;
    subject: string;
    text: string;
    html?: string;
  };
  const sentMessage = () => mocks.sendMail.mock.calls[0][0] as SentMessage;
  const linksIn = (html = '') =>
    [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  const resendConfig = {
    NODE_ENV: 'production',
    RESEND_API_KEY: 'test-api-key',
    EMAIL_FROM: 'ContractFlow <verified@example.com>',
    WEB_URL: 'https://contractflow.example.com',
  };

  it('sends company invitations as HTML with a review CTA and a plain-text fallback', async () => {
    const service = createService({
      NODE_ENV: 'development',
      WEB_URL: 'https://app.example.com',
    });

    await service.sendCompanyInvitationEmail(
      'member@example.com',
      'Example Energy',
      'Member',
      'single-use-token',
    );

    const url =
      'https://app.example.com/invitations/respond?token=single-use-token';
    const { text, html } = sentMessage();
    expect(html).toContain('>Review Invitation</a>');
    expect(html).toContain('Example Energy');
    expect(html).toContain('>Member<');
    expect(html).toContain('expires in 7 days');
    expect(html).toContain('If you weren&#39;t expecting this invitation');
    expect(html).toContain(`>${url}</a>`);
    // Every link opens the review page: none responds to the invitation.
    expect(linksIn(html)).toEqual([url, url]);
    expect(html).not.toMatch(/<script|<link|<style/i);

    expect(text).toContain('Hello,');
    expect(text).toContain('Company: Example Energy');
    expect(text).toContain('Role: Member');
    expect(text).toContain(`Review Invitation: ${url}`);
    expect(text).toContain('expires in 7 days');
    expect(text).toContain("If you weren't expecting this invitation");
  });

  it('sends contract role invitations with the workspace, role and inviting company', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendContractRoleInvitationEmail(
      'member@example.com',
      'Pipeline Upgrade',
      'HSE Officer',
      'hse',
      'role-token',
      'Example Energy',
    );

    const url =
      'http://localhost:3000/invitations/contract-role?token=role-token';
    const { subject, text, html } = sentMessage();
    expect(subject).toBe('Contract role invitation for Pipeline Upgrade');
    expect(html).toContain('>Review Contract Invitation</a>');
    expect(linksIn(html)).toEqual([url, url]);
    for (const value of [
      'Pipeline Upgrade',
      'Example Energy',
      '>HSE<',
      'HSE Officer',
    ]) {
      expect(html).toContain(value);
    }
    expect(text).toContain('Contract: Pipeline Upgrade');
    expect(text).toContain('Invited by: Example Energy');
    expect(text).toContain('Workspace: HSE');
    expect(text).toContain('Contract role: HSE Officer');
    expect(text).toContain(`Review Contract Invitation: ${url}`);
  });

  it('leaves out the inviting company of a role invitation when it is unknown', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendContractRoleInvitationEmail(
      'member@example.com',
      'Pipeline Upgrade',
      'Finance Officer',
      'finance',
      'role-token',
    );

    const { text, html } = sentMessage();
    expect(text).not.toContain('Invited by');
    expect(html).not.toContain('Invited by');
    expect(text).toContain('Workspace: Finance');
  });

  it('sends contract party invitations with the inviting company and party type', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendContractPartyInvitationEmail(
      'company@example.com',
      'Pipeline Upgrade',
      'Example Energy',
      'subcontractor',
      'party-token',
    );

    const url =
      'http://localhost:3000/invitations/contract-party?token=party-token';
    const { subject, text, html } = sentMessage();
    expect(subject).toBe('Contract invitation for Pipeline Upgrade');
    expect(html).toContain('>Review Contract Invitation</a>');
    expect(linksIn(html)).toEqual([url, url]);
    expect(html).toContain('>Subcontractor<');
    expect(text).toContain('Invited by: Example Energy');
    expect(text).toContain('Party type: Subcontractor');
    expect(text).toContain('accept or reject');
    expect(text).toContain(`Review Contract Invitation: ${url}`);
  });

  it('escapes invitation data in the HTML body', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendContractPartyInvitationEmail(
      'company@example.com',
      '<img src=x onerror=alert(1)>',
      'Evil "Co" & <b>Sons</b>',
      'vendor',
      'party-token',
    );

    const { html } = sentMessage();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Evil &quot;Co&quot; &amp; &lt;b&gt;Sons&lt;/b&gt;');
  });

  it('sends invitation HTML and text through Resend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const service = createService(resendConfig);

    await service.sendCompanyInvitationEmail(
      'member@example.com',
      'Example Energy',
      'Member',
      'single-use-token',
    );

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: 'ContractFlow <verified@example.com>',
      to: ['member@example.com'],
      subject: 'Invitation to join Example Energy',
    });
    expect(body.text).toContain(
      'https://contractflow.example.com/invitations/respond?token=single-use-token',
    );
    expect(body.html).toContain('>Review Invitation</a>');
  });

  it('sends verification HTML and text through Resend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const service = createService(resendConfig);

    await service.sendVerificationEmail('user@example.com', 'verify-token');

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(body.text).toContain(
      'https://contractflow.example.com/auth/verify-email?token=verify-token',
    );
    expect(body.html).toContain('>Verify Email Address</a>');
  });

  it('reports Resend invitation delivery failures as before', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const service = createService(resendConfig);

    await expect(
      service.sendContractRoleInvitationEmail(
        'member@example.com',
        'Pipeline Upgrade',
        'HSE Officer',
        'hse',
        'role-token',
      ),
    ).rejects.toThrow('could not be delivered');
  });

  it('names the inviter and the invited address in a company invitation', async () => {
    const service = createService({ NODE_ENV: 'development' });

    await service.sendCompanyInvitationEmail(
      'member@example.com',
      'Example Energy',
      'Member',
      'single-use-token',
      'Ada <Admin>',
    );

    const { text, html } = sentMessage();
    expect(text).toContain(
      'Ada <Admin> invited you to join Example Energy on ContractFlow as Member.',
    );
    expect(text).toContain('Invited by: Ada <Admin>');
    expect(text).toContain('Invited email: member@example.com');
    expect(html).toContain('Ada &lt;Admin&gt;');
    expect(html).not.toContain('<Admin>');
  });

  it.each([
    ['accepted', 'member@example.com joined Example Energy', 'is now a member'],
    [
      'declined',
      'member@example.com declined your invitation to Example Energy',
      'declined your invitation',
    ],
  ] as const)(
    'tells the inviter that an invitation was %s',
    async (decision, subject, phrase) => {
      const service = createService({ NODE_ENV: 'development' });

      await service.sendCompanyInvitationResponseEmail(
        'admin@example.com',
        'Example Energy',
        'member@example.com',
        'Member',
        decision,
      );

      const message = sentMessage();
      const url = 'http://localhost:3000/dashboards/team';
      expect(message.to).toBe('admin@example.com');
      expect(message.subject).toBe(subject);
      expect(message.text).toContain(phrase);
      expect(message.text).toContain(`View Team: ${url}`);
      expect(message.text).not.toContain('expires');
      expect(linksIn(message.html)).toEqual([url, url]);
    },
  );
});
