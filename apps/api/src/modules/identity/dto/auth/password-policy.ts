import type { IsStrongPasswordOptions } from 'class-validator';

/**
 * The password rules for every password a user sets (registration and
 * password reset): at least 12 characters with a lowercase letter, an
 * uppercase letter, a number and a symbol.
 */
export const STRONG_PASSWORD_OPTIONS: IsStrongPasswordOptions = {
  minLength: 12,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

export const MAX_PASSWORD_LENGTH = 255;
