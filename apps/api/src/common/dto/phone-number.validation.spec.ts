import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  splitPhoneNumber,
  validatePhoneNumber,
} from '@contractflow/contracts-schema/phone';
import { CreateCompanyRequestDto } from '../../modules/identity/dto/company/requests/create-company-request.dto';
import { UpdateCompanyProfileRequestDto } from '../../modules/identity/dto/company/requests/update-company-profile-request.dto';
import { CreateAppUserRequestDto } from '../../modules/identity/dto/app-user/requests/create-app-user-request.dto';
import { UpdateAppUserRequestDto } from '../../modules/identity/dto/app-user/requests/update-app-user-request.dto';
import { normalizePhoneNumber } from './phone-number.validation';

const company = {
  name: 'Acme',
  legalName: 'Acme Ltd',
  email: 'ops@acme.test',
  phoneNumber: '+2348031234567',
  addressLine1: '1 Main St',
  city: 'Lagos',
  stateRegion: 'Lagos',
  postalCode: '100001',
  countryCode: 'NG',
  defaultCurrencyCode: 'NGN',
};

const user = {
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Obi',
  password: 'Correct-horse-9!',
  phoneNumber: '',
  timezone: 'Africa/Lagos',
};

async function phoneErrors<T extends object>(
  cls: new () => T,
  body: object,
): Promise<{ dto: T; messages: string[] }> {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto);
  const messages = errors
    .filter((error) => error.property === 'phoneNumber')
    .flatMap((error) => Object.values(error.constraints ?? {}));
  return { dto, messages };
}

describe('validatePhoneNumber (shared form rules)', () => {
  it.each([
    ['NG', '0803 123 4567', '+2348031234567'],
    ['NG', '803 123 4567', '+2348031234567'],
    ['NG', '+234 803 123 4567', '+2348031234567'],
    ['NG', '00234 803 123 4567', '+2348031234567'],
    ['GB', '020 7946 0958', '+442079460958'],
    ['US', '(212) 555-0123', '+12125550123'],
    ['CA', '416 555 0123', '+14165550123'],
    ['GH', '024 123 4567', '+233241234567'],
    ['ZA', '082 123 4567', '+27821234567'],
    ['AE', '050 123 4567', '+971501234567'],
  ])('reads %s %j as %s', (country, national, e164) => {
    expect(validatePhoneNumber(country, national)).toEqual({
      valid: true,
      e164,
      countryCode: country,
    });
  });

  it.each([
    ['NG', '', 'required'],
    ['', '0803 123 4567', 'country_required'],
    ['AQ', '123 456', 'unsupported_country'],
    ['NG', '0803 abc', 'invalid_characters'],
    ['NG', '0803', 'too_short'],
    ['NG', '0803 1234 5678 9012', 'too_long'],
    // The right length range, but outside Nigeria's numbering plan.
    ['NG', '0803 123 45678', 'invalid'],
    // A number from another country, typed with its calling code.
    ['NG', '+44 20 7946 0958', 'other_country'],
    // +1 is shared: a New York number is not a Canadian one.
    ['CA', '212 555 0123', 'other_country'],
  ])('rejects %s %j as %s', (country, national, reason) => {
    const result = validatePhoneNumber(country, national);
    expect(result.valid).toBe(false);
    expect(!result.valid && result.reason).toBe(reason);
  });
});

describe('splitPhoneNumber', () => {
  it('splits an E.164 number into country and national number', () => {
    expect(splitPhoneNumber('+2348031234567')).toEqual({
      countryCode: 'NG',
      nationalNumber: '803 123 4567',
      recognized: true,
    });
    expect(splitPhoneNumber('+14165550123').countryCode).toBe('CA');
  });

  it('reads a number saved without a calling code in the fallback country', () => {
    expect(splitPhoneNumber('08031234567', 'NG')).toEqual({
      countryCode: 'NG',
      nationalNumber: '803 123 4567',
      recognized: true,
    });
  });

  it('keeps an unreadable saved value so it is never lost', () => {
    expect(splitPhoneNumber('ask reception', 'NG')).toEqual({
      countryCode: 'NG',
      nationalNumber: 'ask reception',
      recognized: false,
    });
    expect(splitPhoneNumber('0803 123', null).countryCode).toBe('');
  });
});

describe('IsInternationalPhoneNumber', () => {
  it('normalises a formatted international number to E.164', () => {
    expect(normalizePhoneNumber(' +234 (803) 123-4567 ')).toBe(
      '+2348031234567',
    );
    expect(normalizePhoneNumber('0803')).toBe('0803');
    expect(normalizePhoneNumber(12)).toBe(12);
  });

  it('stores company numbers in E.164', async () => {
    const { dto, messages } = await phoneErrors(CreateCompanyRequestDto, {
      ...company,
      phoneNumber: '+234 803 123 4567',
    });
    expect(messages).toEqual([]);
    expect(dto.phoneNumber).toBe('+2348031234567');
  });

  it.each(['', '08031234567', '+234 803', '+10000000000', 'call us'])(
    'rejects company number %j',
    async (phoneNumber) => {
      const { messages } = await phoneErrors(CreateCompanyRequestDto, {
        ...company,
        phoneNumber,
      });
      expect(messages).toHaveLength(1);
    },
  );

  it('explains that the calling code is needed', async () => {
    const { messages } = await phoneErrors(CreateCompanyRequestDto, {
      ...company,
      phoneNumber: '08031234567',
    });
    expect(messages[0]).toContain('Include the country calling code');
  });

  it('leaves a saved company number alone when a profile update omits it', async () => {
    const { messages } = await phoneErrors(UpdateCompanyProfileRequestDto, {
      name: 'Acme',
    });
    expect(messages).toEqual([]);
  });

  it('validates a company number sent in a profile update', async () => {
    const { messages } = await phoneErrors(UpdateCompanyProfileRequestDto, {
      phoneNumber: '0803',
    });
    expect(messages).toHaveLength(1);
  });

  it('keeps the phone number optional at registration', async () => {
    const { dto, messages } = await phoneErrors(CreateAppUserRequestDto, user);
    expect(messages).toEqual([]);
    expect(dto.phoneNumber).toBe('');
  });

  it('normalises and validates a registration number', async () => {
    const valid = await phoneErrors(CreateAppUserRequestDto, {
      ...user,
      phoneNumber: '+44 20 7946 0958',
    });
    expect(valid.messages).toEqual([]);
    expect(valid.dto.phoneNumber).toBe('+442079460958');

    const invalid = await phoneErrors(CreateAppUserRequestDto, {
      ...user,
      phoneNumber: '1'.repeat(30),
    });
    expect(invalid.messages).toHaveLength(1);
  });

  it('lets a user clear or replace their own number', async () => {
    expect(
      (await phoneErrors(UpdateAppUserRequestDto, { phoneNumber: '' }))
        .messages,
    ).toEqual([]);
    expect(
      (await phoneErrors(UpdateAppUserRequestDto, { phoneNumber: '12345' }))
        .messages,
    ).toHaveLength(1);
  });
});
