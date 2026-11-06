import { createHash } from 'node:crypto';
import { ECompanyStatus } from '@contractflow/contracts-schema';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { MailService } from '../../../mail/mail.service';
import type {
  ICompanyVerificationContext,
  ICompanyVerificationUnitOfWork,
} from '../../interface/company-verification-persistence.interface';
import { CompanyVerificationService } from './company-verification.service';

const token = 'a'.repeat(43);
const tokenHash = createHash('sha256').update(token).digest('hex');

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-1',
    name: 'Acme Works',
    email: 'office@acme.example',
    status: ECompanyStatus.ACTIVE,
    verifiedAt: null as Date | null,
    ...overrides,
  };
}

function makeToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'token-1',
    companyId: 'company-1',
    email: 'office@acme.example',
    tokenHash,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null as Date | null,
    createdAt: new Date(Date.now() - 5 * 60_000),
    ...overrides,
  };
}

describe('CompanyVerificationService', () => {
  let context: Mocked<ICompanyVerificationContext>;
  let mail: { sendCompanyVerificationEmail: ReturnType<typeof vi.fn> };
  let service: CompanyVerificationService;

  beforeEach(() => {
    context = {
      findCompanyForUpdate: vi.fn().mockResolvedValue(makeCompany()),
      findOtherVerifiedCompanyByEmail: vi.fn().mockResolvedValue(null),
      saveCompany: vi.fn(async (company) => company),
      isActiveCompanyAdmin: vi.fn().mockResolvedValue(true),
      createToken: vi.fn(async (data) => ({ id: 'token-2', ...data })),
      findTokenByHashForUpdate: vi.fn().mockResolvedValue(makeToken()),
      findLatestToken: vi.fn().mockResolvedValue(null),
      invalidateUnusedTokens: vi.fn(),
      saveToken: vi.fn(async (record) => record),
    } as unknown as Mocked<ICompanyVerificationContext>;
    mail = { sendCompanyVerificationEmail: vi.fn() };
    service = new CompanyVerificationService(
      {
        execute: (operation) => operation(context),
      } as ICompanyVerificationUnitOfWork,
      mail as unknown as MailService,
    );
  });

  it('marks the company verified and uses up the link', async () => {
    await expect(service.verify(token)).resolves.toEqual({
      message: 'Your company email is verified.',
      companyName: 'Acme Works',
    });

    expect(context.findTokenByHashForUpdate).toHaveBeenCalledWith(tokenHash);
    expect(context.saveToken).toHaveBeenCalledWith(
      expect.objectContaining({ usedAt: expect.any(Date) }),
    );
    expect(context.saveCompany).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedAt: expect.any(Date) }),
    );
  });

  it.each([
    ['unknown', null],
    ['used', makeToken({ usedAt: new Date() })],
    ['expired', makeToken({ expiresAt: new Date(Date.now() - 1) })],
    ['for an old email', makeToken({ email: 'previous@acme.example' })],
  ])('rejects a link that is %s', async (_label, record) => {
    context.findTokenByHashForUpdate.mockResolvedValue(record as never);

    await expect(service.verify(token)).rejects.toThrow(
      'This verification link is invalid, expired, or already used.',
    );
    expect(context.saveCompany).not.toHaveBeenCalled();
  });

  it('refuses a second verified company with the same email', async () => {
    context.findOtherVerifiedCompanyByEmail.mockResolvedValue(
      makeCompany({ id: 'company-2', verifiedAt: new Date() }) as never,
    );

    await expect(service.verify(token)).rejects.toThrow(
      'Another company has already verified this email address.',
    );
    expect(context.saveCompany).not.toHaveBeenCalled();
  });

  it('reports a concurrent verification of the same email as a conflict', async () => {
    context.saveCompany.mockRejectedValue({ code: '23505' });

    await expect(service.verify(token)).rejects.toThrow(
      'Another company has already verified this email address.',
    );
  });

  it('emails a new hashed link after a company is created or its email changes', async () => {
    await service.sendAfterEmailChange('company-1');

    expect(context.invalidateUnusedTokens).toHaveBeenCalledWith(
      'company-1',
      expect.any(Date),
    );
    const created = context.createToken.mock.calls[0]?.[0];
    expect(created).toMatchObject({
      companyId: 'company-1',
      email: 'office@acme.example',
      usedAt: null,
    });
    const sentToken = mail.sendCompanyVerificationEmail.mock.calls[0]?.[2];
    expect(created?.tokenHash).toBe(
      createHash('sha256').update(sentToken).digest('hex'),
    );
    expect(mail.sendCompanyVerificationEmail).toHaveBeenCalledWith(
      'office@acme.example',
      'Acme Works',
      sentToken,
    );
  });

  it('does not fail the company change when the email cannot be delivered', async () => {
    mail.sendCompanyVerificationEmail.mockRejectedValue(new Error('SMTP down'));

    await expect(
      service.sendAfterEmailChange('company-1'),
    ).resolves.toBeUndefined();
  });

  it('lets only a company administrator resend the link', async () => {
    context.isActiveCompanyAdmin.mockResolvedValue(false);

    await expect(service.resend('user-1', 'company-1')).rejects.toThrow(
      'Only company administrators can verify the company email.',
    );
    expect(context.createToken).not.toHaveBeenCalled();
  });

  it('limits resends to one a minute', async () => {
    context.findLatestToken.mockResolvedValue(
      makeToken({ createdAt: new Date() }) as never,
    );

    await expect(service.resend('user-1', 'company-1')).rejects.toThrow(
      'A verification link was sent recently.',
    );
    expect(mail.sendCompanyVerificationEmail).not.toHaveBeenCalled();
  });

  it('tells an administrator when the email is already verified', async () => {
    context.findCompanyForUpdate.mockResolvedValue(
      makeCompany({ verifiedAt: new Date() }) as never,
    );

    await expect(service.resend('user-1', 'company-1')).rejects.toThrow(
      'The company email is already verified.',
    );
  });

  it('warns before resending when another company already verified the email', async () => {
    context.findOtherVerifiedCompanyByEmail.mockResolvedValue(
      makeCompany({ id: 'company-2', verifiedAt: new Date() }) as never,
    );

    await expect(service.resend('user-1', 'company-1')).rejects.toThrow(
      'Another company has already verified this email address.',
    );
    expect(mail.sendCompanyVerificationEmail).not.toHaveBeenCalled();
  });
});
