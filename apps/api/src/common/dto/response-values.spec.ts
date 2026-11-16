import { describe, expect, it } from 'vitest';
import {
  toDateOnly,
  toIntegerString,
  toNullable,
  toNullableDateOnly,
  toNullableIntegerString,
  toNullableText,
  toNullableTimestamp,
  toTimestamp,
} from './response-values';

describe('response values', () => {
  it('formats instants as UTC ISO timestamps', () => {
    expect(toTimestamp(new Date('2026-04-10T07:15:00+01:00'))).toBe(
      '2026-04-10T06:15:00.000Z',
    );
    expect(toTimestamp('2026-04-10T07:15:00.000Z')).toBe(
      '2026-04-10T07:15:00.000Z',
    );
    expect(toNullableTimestamp(null)).toBeNull();
    expect(toNullableTimestamp(undefined)).toBeNull();
  });

  it('keeps calendar dates as YYYY-MM-DD without shifting the day', () => {
    // node-postgres returns `date` columns as strings.
    expect(toDateOnly('2026-12-31')).toBe('2026-12-31');
    expect(toDateOnly(new Date('2026-12-31T00:00:00.000Z'))).toBe('2026-12-31');
    expect(toNullableDateOnly('')).toBeNull();
    expect(toNullableDateOnly(null)).toBeNull();
  });

  it('keeps 64-bit integers exact as decimal strings', () => {
    // 2^53 + 1 cannot be represented as a JavaScript number.
    expect(toIntegerString('9007199254740993')).toBe('9007199254740993');
    expect(toIntegerString(-150000)).toBe('-150000');
    expect(toIntegerString(' 42 ')).toBe('42');
    expect(toIntegerString(12n)).toBe('12');
    expect(toNullableIntegerString(null)).toBeNull();
    expect(() => toIntegerString('12.5')).toThrow('whole number');
    expect(() => toIntegerString('abc')).toThrow('whole number');
  });

  it('treats empty and missing later-stage values as unset', () => {
    expect(toNullableText('')).toBeNull();
    expect(toNullableText(undefined)).toBeNull();
    expect(toNullableText('Approved with notes')).toBe('Approved with notes');
    expect(toNullable('')).toBeNull();
    expect(toNullable(0)).toBe(0);
    expect(toNullable(false)).toBe(false);
  });
});
