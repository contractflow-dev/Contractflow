import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ChangePasswordRequestDto } from './change-password-request.dto';
import { UpdateAppUserRequestDto } from './update-app-user-request.dto';

const errorsOf = async <T extends object>(
  type: new () => T,
  body: Record<string, unknown>,
) =>
  (
    await validate(plainToInstance(type, body), {
      whitelist: true,
      forbidUnknownValues: false,
    })
  ).map(({ property }) => property);

describe('UpdateAppUserRequestDto', () => {
  it('accepts any subset of profile fields, trimmed', async () => {
    const dto = plainToInstance(UpdateAppUserRequestDto, {
      firstName: '  Ada  ',
      timezone: 'Africa/Lagos',
    });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.firstName).toBe('Ada');
    await expect(errorsOf(UpdateAppUserRequestDto, {})).resolves.toEqual([]);
  });

  it('allows clearing the middle name but not the first or last name', async () => {
    await expect(
      errorsOf(UpdateAppUserRequestDto, { middleName: '' }),
    ).resolves.toEqual([]);
    await expect(
      errorsOf(UpdateAppUserRequestDto, { firstName: '   ', lastName: '' }),
    ).resolves.toEqual(['firstName', 'lastName']);
  });

  it('rejects an unknown time zone and a phone number longer than its column', async () => {
    await expect(
      errorsOf(UpdateAppUserRequestDto, {
        timezone: 'Mars/Olympus',
        phoneNumber: '+'.padEnd(21, '1'),
      }),
    ).resolves.toEqual(['phoneNumber', 'timezone']);
  });

  it('has no email, status or admin field, so the global whitelist strips them', async () => {
    const dto = plainToInstance(UpdateAppUserRequestDto, {
      lastName: 'Eze',
      email: 'new@example.com',
      status: 'active',
      isPlatformAdmin: true,
    });
    // The global ValidationPipe validates with whitelist: true.
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    expect({ ...dto }).toEqual({ lastName: 'Eze' });
  });
});

describe('ChangePasswordRequestDto', () => {
  it('accepts a strong new password', async () => {
    await expect(
      errorsOf(ChangePasswordRequestDto, {
        currentPassword: 'anything',
        newPassword: 'Brand-New-Pass-2',
      }),
    ).resolves.toEqual([]);
  });

  it('applies the registration password policy to the new password only', async () => {
    await expect(
      errorsOf(ChangePasswordRequestDto, {
        currentPassword: 'short',
        newPassword: 'weakpassword',
      }),
    ).resolves.toEqual(['newPassword']);
  });

  it('requires both passwords', async () => {
    await expect(errorsOf(ChangePasswordRequestDto, {})).resolves.toEqual([
      'currentPassword',
      'newPassword',
    ]);
  });
});
