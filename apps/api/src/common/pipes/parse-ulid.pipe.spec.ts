import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseUlidPipe } from './parse-ulid.pipe';

describe('ParseUlidPipe', () => {
  const pipe = new ParseUlidPipe();
  const metadata = { type: 'param', data: 'milestoneId' } as const;

  it.each([
    '01JD4X2Y3Z4A5B6C7D8E9F0G1H',
    '7ZZZZZZZZZZZZZZZZZZZZZZZZZ',
    '01jd4x2y3z4a5b6c7d8e9f0g1h',
  ])('accepts the ULID %s unchanged', (value) => {
    expect(pipe.transform(value, metadata)).toBe(value);
  });

  it.each([
    ['a UUID', '0b1e3b9c-4f2a-4c1e-9a61-2f8d7c1b5e10'],
    ['too short', '01JD4X2Y3Z4A5B6C7D8E9F0G1'],
    ['too long', '01JD4X2Y3Z4A5B6C7D8E9F0G1HH'],
    ['above the 128-bit range', '8ZZZZZZZZZZZZZZZZZZZZZZZZZ'],
    ['letters Crockford leaves out', '01JD4X2Y3Z4A5B6C7D8E9F0GIL'],
    ['SQL', "1' OR '1'='1"],
    ['empty', ''],
    ['not a string', 42],
  ])('rejects %s with 400, naming the parameter', (_label, value) => {
    expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
    expect(() => pipe.transform(value, metadata)).toThrow(
      'milestoneId must be a valid ULID.',
    );
  });
});
