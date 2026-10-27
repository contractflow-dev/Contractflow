import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateCompanyRequestDto } from './update-company-request.dto';
import { CreateCompanyInvitationRequestDto } from './create-company-invitation-request.dto';
import { InviteCompanyMemberRequestDto } from './requests/invite-company-member-request.dto';
import { EInvitationRole } from '@contractflow/contracts-schema';

describe('Company management DTO validation', () => {
  it('trims allowed company profile fields and strips protected fields', () => {
    const input = plainToInstance(UpdateCompanyRequestDto, {
      name: '  Updated Company  ',
      website: '',
      addressLine2: '  ',
      status: 'inactive',
      verifiedAt: new Date(),
      id: 'another-company',
    });

    expect(validateSync(input, { whitelist: true })).toHaveLength(0);
    expect(input.name).toBe('Updated Company');
    expect(input.website).toBe('');
    expect(input.addressLine2).toBe('');
    expect(input).not.toHaveProperty('status');
    expect(input).not.toHaveProperty('verifiedAt');
    expect(input).not.toHaveProperty('id');
  });

  it('rejects invalid profile values', () => {
    const input = plainToInstance(UpdateCompanyRequestDto, {
      name: '',
      countryCode: 'USA',
      defaultCurrencyCode: 'US',
    });

    const invalidFields = validateSync(input).map(({ property }) => property);

    expect(invalidFields).toContain('name');
    expect(invalidFields).toContain('countryCode');
    expect(invalidFields).toContain('defaultCurrencyCode');
  });

  it('normalizes invitation email and rejects a company-admin invite role', () => {
    const input = plainToInstance(CreateCompanyInvitationRequestDto, {
      email: ' Invitee@Example.com ',
      companyRole: 'Company Administrator',
    });

    const invalidFields = validateSync(input).map(({ property }) => property);

    expect(input.email).toBe('invitee@example.com');
    expect(invalidFields).toContain('companyRole');
  });

  it('accepts a company invitation with only email and an allowed role', () => {
    const input = plainToInstance(InviteCompanyMemberRequestDto, {
      email: ' Invitee@Example.com ',
      companyRole: EInvitationRole.FINANCE_OFFICER,
    });

    expect(validateSync(input, { whitelist: true })).toHaveLength(0);
    expect(input.email).toBe('invitee@example.com');
  });

  it.each([
    [{ companyRole: EInvitationRole.FINANCE_OFFICER }, 'email'],
    [{ email: 'invitee@example.com' }, 'companyRole'],
    [
      { email: 'not-an-email', companyRole: EInvitationRole.FINANCE_OFFICER },
      'email',
    ],
    [
      { email: 'invitee@example.com', companyRole: 'Company Administrator' },
      'companyRole',
    ],
  ])('rejects invalid company invitation payload %#', (payload, field) => {
    const input = plainToInstance(InviteCompanyMemberRequestDto, payload);
    const invalidFields = validateSync(input).map(({ property }) => property);

    expect(invalidFields).toContain(field);
  });
});
