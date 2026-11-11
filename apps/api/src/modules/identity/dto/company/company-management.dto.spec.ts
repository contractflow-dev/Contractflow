import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateCompanyRequestDto } from './update-company-request.dto';
import {
  CreateCompanyRequestDto,
  normalizeWebsite,
} from './requests/create-company-request.dto';
import { CreateCompanyInvitationRequestDto } from './create-company-invitation-request.dto';
import { InviteCompanyMemberRequestDto } from './requests/invite-company-member-request.dto';
import { ECompanyRole } from '@contractflow/contracts-schema';

describe('Company management DTO validation', () => {
  it('normalizes a website without a protocol for company creation', () => {
    const input = plainToInstance(CreateCompanyRequestDto, {
      name: 'Example Company',
      legalName: 'Example Company Ltd',
      registrationNumber: 'REG-1',
      taxIdentificationNumber: 'TAX-1',
      email: 'company@example.com',
      phoneNumber: '+10000000000',
      website: 'www.greatbuilder.com',
      addressLine1: '1 Test Street',
      city: 'Test City',
      stateRegion: 'Test Region',
      postalCode: '10000',
      countryCode: 'NG',
      defaultCurrencyCode: 'NGN',
    });

    expect(validateSync(input).map(({ property }) => property)).not.toContain(
      'website',
    );
    expect(input.website).toBe('https://www.greatbuilder.com');
    expect(normalizeWebsite('www.greatbuilder.com')).toBe(
      'https://www.greatbuilder.com',
    );
  });

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

  it.each([ECompanyRole.COMPANY_ADMIN, ECompanyRole.MEMBER])(
    'accepts %s as a company invitation role and normalizes the email',
    (companyRole) => {
      const input = plainToInstance(CreateCompanyInvitationRequestDto, {
        email: ' Invitee@Example.com ',
        companyRole,
      });

      expect(validateSync(input, { whitelist: true })).toHaveLength(0);
      expect(input.email).toBe('invitee@example.com');
      expect(input.companyRole).toBe(companyRole);
    },
  );

  it('accepts a company invitation with only email and an allowed role', () => {
    const input = plainToInstance(InviteCompanyMemberRequestDto, {
      email: ' Invitee@Example.com ',
      companyRole: ECompanyRole.MEMBER,
    });

    expect(validateSync(input, { whitelist: true })).toHaveLength(0);
    expect(input.email).toBe('invitee@example.com');
  });

  it('accepts optional trimmed names on a company invitation', () => {
    const input = plainToInstance(InviteCompanyMemberRequestDto, {
      email: 'invitee@example.com',
      firstName: '  Ada ',
      lastName: ' Obi  ',
      companyRole: ECompanyRole.MEMBER,
    });

    expect(validateSync(input, { whitelist: true })).toHaveLength(0);
    expect(input.firstName).toBe('Ada');
    expect(input.lastName).toBe('Obi');
  });

  it('strips contract-role and workspace fields from a company invitation', () => {
    const input = plainToInstance(InviteCompanyMemberRequestDto, {
      email: 'invitee@example.com',
      companyRole: ECompanyRole.MEMBER,
      contractRole: 'Contractor Project Lead',
      role: 'HSE Officer',
      workspace: 'project',
      isWorkspaceAdmin: true,
      contractId: '01HZZZZZZZZZZZZZZZZZZZZZZZ',
    });

    expect(validateSync(input, { whitelist: true })).toHaveLength(0);
    const kept = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
      .sort();
    expect(kept).toEqual(['companyRole', 'email']);
  });

  it.each([
    [{ companyRole: ECompanyRole.MEMBER }, 'email'],
    [{ email: 'invitee@example.com' }, 'companyRole'],
    [{ email: 'not-an-email', companyRole: ECompanyRole.MEMBER }, 'email'],
    // Contract roles are not company roles any more.
    [
      { email: 'invitee@example.com', companyRole: 'Finance Officer' },
      'companyRole',
    ],
    [
      { email: 'invitee@example.com', companyRole: 'Contractor Project Lead' },
      'companyRole',
    ],
    [
      {
        email: 'invitee@example.com',
        companyRole: ECompanyRole.MEMBER,
        firstName: '',
      },
      'firstName',
    ],
  ])('rejects invalid company invitation payload %#', (payload, field) => {
    const input = plainToInstance(InviteCompanyMemberRequestDto, payload);
    const invalidFields = validateSync(input).map(({ property }) => property);

    expect(invalidFields).toContain(field);
  });
});
