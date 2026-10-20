import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateCompanyRequestDto } from './update-company-request.dto';
import { CreateCompanyInvitationRequestDto } from './create-company-invitation-request.dto';

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
      firstName: ' New ',
      lastName: ' Member ',
      companyRole: 'Company Administrator',
    });

    const invalidFields = validateSync(input).map(({ property }) => property);

    expect(input.email).toBe('invitee@example.com');
    expect(input.firstName).toBe('New');
    expect(input.lastName).toBe('Member');
    expect(invalidFields).toContain('companyRole');
  });
});
