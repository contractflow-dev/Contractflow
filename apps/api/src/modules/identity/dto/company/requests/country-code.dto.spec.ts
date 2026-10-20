import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCompanyRequestDto } from './create-company-request.dto';
import { UpdateCompanyProfileRequestDto } from './update-company-profile-request.dto';

const valid = {
  name: 'Acme',
  legalName: 'Acme Ltd',
  registrationNumber: 'RC123',
  taxIdentificationNumber: 'TIN123',
  email: 'ops@acme.test',
  phoneNumber: '+2348000000000',
  addressLine1: '1 Main St',
  city: 'Lagos',
  stateRegion: 'Lagos',
  postalCode: '100001',
  countryCode: 'NG',
  defaultCurrencyCode: 'NGN',
};

async function countryErrors<T extends object>(
  cls: new () => T,
  countryCode: unknown,
) {
  const errors = await validate(
    plainToInstance(cls, { ...valid, countryCode }),
  );
  return errors.filter((error) => error.property === 'countryCode');
}

describe('countryCode validation', () => {
  it('accepts and normalises a valid ISO country code', async () => {
    const dto = plainToInstance(CreateCompanyRequestDto, {
      ...valid,
      countryCode: ' ng ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.countryCode).toBe('NG');
  });

  it.each(['XX', 'NGA', 'N', '', 12])('rejects %j on create', async (code) => {
    expect(await countryErrors(CreateCompanyRequestDto, code)).toHaveLength(1);
  });

  it('applies the same enum check to profile updates', async () => {
    expect(
      await countryErrors(UpdateCompanyProfileRequestDto, 'XX'),
    ).toHaveLength(1);
    expect(
      await countryErrors(UpdateCompanyProfileRequestDto, 'us'),
    ).toHaveLength(0);
  });
});
