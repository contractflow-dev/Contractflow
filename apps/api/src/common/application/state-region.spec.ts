import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { resolveStateRegion, resolveStateRegionUpdate } from './state-region';

describe('resolveStateRegion', () => {
  it('stores the canonical subdivision name for a name or code', () => {
    expect(resolveStateRegion('NG', 'lagos')).toBe('Lagos');
    expect(resolveStateRegion('NG', 'NG-RI')).toBe('Rivers');
    expect(resolveStateRegion('NG', 'FCT')).toBe('Federal Capital Territory');
    expect(resolveStateRegion('US', 'CA')).toBe('California');
  });

  it('accepts a legacy spelling such as "Lagos State"', () => {
    expect(resolveStateRegion('NG', ' Lagos State ')).toBe('Lagos');
  });

  it('rejects a subdivision of another country', () => {
    expect(() => resolveStateRegion('US', 'Lagos')).toThrow(
      BadRequestException,
    );
    expect(() => resolveStateRegion('GH', 'Rivers')).toThrow(
      BadRequestException,
    );
  });

  it('requires a subdivision where the country has supported ones', () => {
    expect(() => resolveStateRegion('NG', '  ')).toThrow('Select a state.');
  });

  it('accepts optional free text for a country without supported subdivisions', () => {
    expect(resolveStateRegion('GI', '')).toBe('');
    expect(resolveStateRegion('SJ', ' Longyearbyen ')).toBe('Longyearbyen');
    expect(() => resolveStateRegion('GI', 'x'.repeat(101))).toThrow(
      BadRequestException,
    );
  });
});

describe('resolveStateRegionUpdate', () => {
  const legacy = { countryCode: 'NG', stateRegion: 'Somewhere old' };

  it('leaves an unedited legacy value alone', () => {
    expect(resolveStateRegionUpdate(legacy, {})).toBeUndefined();
  });

  it('checks the region against the saved country', () => {
    expect(resolveStateRegionUpdate(legacy, { stateRegion: 'Bayelsa' })).toBe(
      'Bayelsa',
    );
  });

  it('rejects a country change that keeps the old country’s region', () => {
    expect(() =>
      resolveStateRegionUpdate(
        { countryCode: 'NG', stateRegion: 'Lagos' },
        { countryCode: 'US' },
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts a country change sent with a region of the new country', () => {
    expect(
      resolveStateRegionUpdate(
        { countryCode: 'NG', stateRegion: 'Lagos' },
        { countryCode: 'CA', stateRegion: 'Yukon' },
      ),
    ).toBe('Yukon');
  });
});
