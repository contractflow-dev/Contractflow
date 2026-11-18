import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  MINOR_AMOUNT_MAX,
  MINOR_AMOUNT_MIN,
  isMinorAmount,
  minorAmountToBigInt,
  toMinorAmount,
  validateMinorAmount,
  type MinorAmount,
} from '@contractflow/contracts-schema/money';
import { CreateContractRequestDto } from '../../modules/contract/dto/create-contract-request.dto';
import { UpdateContractRequestDto } from '../../modules/contract/dto/update-contract-request.dto';
import { IsMinorAmount } from './minor-amount.validation';

const BIGINT_MAX = '9223372036854775807';
const BIGINT_MIN = '-9223372036854775808';

describe('MinorAmount (shared validation)', () => {
  it('uses the PostgreSQL bigint range', () => {
    expect(MINOR_AMOUNT_MAX).toBe(BIGINT_MAX);
    expect(MINOR_AMOUNT_MIN).toBe(BIGINT_MIN);
  });

  it('accepts whole numbers of minor units written as canonical digit strings', () => {
    for (const value of ['0', '1', '250000000', '9007199254740993']) {
      expect(validateMinorAmount(value)).toEqual({
        valid: true,
        amount: BigInt(value),
      });
    }
    expect(isMinorAmount('-150000')).toBe(true);
  });

  it('accepts the bigint boundaries and rejects one past them', () => {
    expect(isMinorAmount(BIGINT_MAX)).toBe(true);
    expect(isMinorAmount(BIGINT_MIN)).toBe(true);
    expect(validateMinorAmount('9223372036854775808')).toMatchObject({
      valid: false,
      reason: 'out_of_range',
    });
    expect(validateMinorAmount('-9223372036854775809')).toMatchObject({
      valid: false,
      reason: 'out_of_range',
    });
  });

  it('rejects JavaScript numbers instead of converting them', () => {
    for (const value of [100, 0, 12.5, Number.MAX_SAFE_INTEGER + 2]) {
      expect(validateMinorAmount(value)).toMatchObject({
        valid: false,
        reason: 'not_string',
      });
    }
    expect(validateMinorAmount(BigInt(5))).toMatchObject({
      reason: 'not_string',
    });
    expect(validateMinorAmount(null)).toMatchObject({ reason: 'not_string' });
  });

  it('rejects decimals, exponents, whitespace, signs and other text', () => {
    for (const value of [
      '12.5',
      '12.',
      '.5',
      '1e6',
      '1E6',
      ' 100',
      '100 ',
      '1 000',
      '1,000',
      '+100',
      '--1',
      'abc',
      '',
      '0x10',
      'Infinity',
      'NaN',
    ]) {
      expect(validateMinorAmount(value)).toMatchObject({
        valid: false,
        reason: 'format',
      });
    }
  });

  it('rejects non-canonical forms rather than rewriting them', () => {
    for (const value of ['007', '00', '-0', '-007']) {
      expect(validateMinorAmount(value)).toMatchObject({
        valid: false,
        reason: 'format',
      });
    }
  });

  it("applies each field's own sign rule", () => {
    expect(isMinorAmount('-1', { sign: 'any' })).toBe(true);
    expect(isMinorAmount('0', { sign: 'non-negative' })).toBe(true);
    expect(validateMinorAmount('-1', { sign: 'non-negative' })).toMatchObject({
      valid: false,
      reason: 'negative',
    });
    expect(isMinorAmount('1', { sign: 'positive' })).toBe(true);
    expect(validateMinorAmount('0', { sign: 'positive' })).toMatchObject({
      valid: false,
      reason: 'not_positive',
    });
    expect(validateMinorAmount('-5', { sign: 'positive' })).toMatchObject({
      reason: 'not_positive',
    });
  });

  it('calculates exactly with BigInt and returns amounts as strings', () => {
    // 2^53 + 1 and 2^53 are the same JavaScript number, but different amounts.
    const original: MinorAmount = '9007199254740993';
    const variation: MinorAmount = '-150000';
    const current = toMinorAmount(
      minorAmountToBigInt(original) + minorAmountToBigInt(variation),
    );
    expect(current).toBe('9007199254590993');
    expect(typeof current).toBe('string');
    expect(minorAmountToBigInt(original)).not.toBe(
      minorAmountToBigInt('9007199254740992'),
    );
  });

  it('refuses to calculate with, or produce, an amount that is not valid', () => {
    expect(() => minorAmountToBigInt('12.5')).toThrow(RangeError);
    expect(() => toMinorAmount(BigInt(MINOR_AMOUNT_MAX) + BigInt(1))).toThrow(
      RangeError,
    );
  });
});

class SignedAmountDto {
  @IsMinorAmount('any')
  delta!: MinorAmount;
}

class PositiveAmountDto {
  @IsOptional()
  @IsMinorAmount('positive')
  amount?: MinorAmount | null;
}

const errorsFor = (dtoClass: new () => object, input: object) =>
  validateSync(plainToInstance(dtoClass, input), { whitelist: true });

const messagesFor = (dtoClass: new () => object, input: object) =>
  errorsFor(dtoClass, input).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );

describe('IsMinorAmount (request DTO validation)', () => {
  it('accepts negative amounts only where the field allows them', () => {
    expect(errorsFor(SignedAmountDto, { delta: '-150000' })).toEqual([]);
    expect(messagesFor(PositiveAmountDto, { amount: '0' })).toEqual([
      'amount must be more than zero.',
    ]);
    expect(errorsFor(PositiveAmountDto, {})).toEqual([]);
    expect(errorsFor(PositiveAmountDto, { amount: null })).toEqual([]);
  });

  it('names the field and the rule in its message', () => {
    expect(messagesFor(SignedAmountDto, { delta: 100 })).toEqual([
      'delta must be a whole number of minor units sent as a string, such as "250000".',
    ]);
    expect(messagesFor(SignedAmountDto, { delta: '1.5' })).toEqual([
      'delta must contain only digits, with an optional leading minus sign and no leading zeros, decimals or spaces.',
    ]);
  });
});

describe('contract request monetary fields', () => {
  const contract = {
    referenceNumber: 'CTR-1',
    title: 'Pipeline integrity',
    contractType: 'service',
    partyType: 'client',
    workspaces: [],
    originalValueMinor: '250000000',
    currencyCode: 'NGN',
    retentionRateBps: 500,
    paymentTermsDays: 30,
    awardDate: '2026-01-01',
    startDate: '2026-01-02',
    endDate: '2027-01-01',
    defectsLiabilityDays: 365,
    timezone: 'Africa/Lagos',
  };
  const failing = (
    input: object,
    dtoClass: new () => object = CreateContractRequestDto,
  ) => errorsFor(dtoClass, input).map(({ property }) => property);

  it('accepts string amounts, zero, and amounts beyond the safe integer range', () => {
    expect(failing(contract)).toEqual([]);
    expect(failing({ ...contract, originalValueMinor: '0' })).toEqual([]);
    expect(
      failing({
        ...contract,
        originalValueMinor: BIGINT_MAX,
        liquidatedDamagesPerDayMinor: '9007199254740993',
      }),
    ).toEqual([]);
  });

  it('keeps the amount exactly as sent', () => {
    const dto = plainToInstance(CreateContractRequestDto, {
      ...contract,
      originalValueMinor: '9007199254740993',
    });
    expect(dto.originalValueMinor).toBe('9007199254740993');
  });

  it('leaves liquidated damages optional', () => {
    expect(
      failing({ ...contract, liquidatedDamagesPerDayMinor: null }),
    ).toEqual([]);
  });

  it('rejects numbers, decimals, negatives and out-of-range contract amounts', () => {
    for (const originalValueMinor of [
      250000000,
      '2500000.00',
      '-1',
      '2.5e8',
      ' 250000000',
      '9223372036854775808',
    ]) {
      expect(failing({ ...contract, originalValueMinor })).toEqual([
        'originalValueMinor',
      ]);
    }
    for (const liquidatedDamagesPerDayMinor of [500000, '-500000', '5000.5']) {
      expect(failing({ ...contract, liquidatedDamagesPerDayMinor })).toEqual([
        'liquidatedDamagesPerDayMinor',
      ]);
    }
  });

  it('applies the same rules when a contract is updated', () => {
    expect(
      failing({ originalValueMinor: '100000' }, UpdateContractRequestDto),
    ).toEqual([]);
    expect(
      failing({ originalValueMinor: 100000 }, UpdateContractRequestDto),
    ).toEqual(['originalValueMinor']);
    expect(
      failing({ liquidatedDamagesPerDayMinor: '-1' }, UpdateContractRequestDto),
    ).toEqual(['liquidatedDamagesPerDayMinor']);
  });
});
