import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, ValidateBy } from 'class-validator';
import { validateInternationalPhoneNumber } from '@contractflow/contracts-schema/phone';

/**
 * Trims the value and, when it is a valid international number, rewrites it
 * in E.164 (`+234 803 123 4567` becomes `+2348031234567`). Anything else is
 * left for the validator to reject with its message.
 */
export function normalizePhoneNumber(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  const result = validateInternationalPhoneNumber(text);
  return result.valid ? result.e164 : text;
}

/**
 * A phone number in international format, stored in E.164. The calling code
 * is required: without it a trunk prefix such as Nigeria's leading 0 cannot
 * be interpreted.
 *
 * With `allowEmpty`, an empty string is accepted for optional numbers.
 * Combine with `@IsOptional()` for fields that may be left out entirely.
 */
export function IsInternationalPhoneNumber(
  options: { allowEmpty?: boolean } = {},
): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => normalizePhoneNumber(value)),
    IsString(),
    ValidateBy({
      name: 'isInternationalPhoneNumber',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          ((options.allowEmpty === true && value === '') ||
            validateInternationalPhoneNumber(value).valid),
        defaultMessage: (args) => {
          const result = validateInternationalPhoneNumber(
            typeof args?.value === 'string' ? args.value : '',
          );
          return result.valid ? '' : `${args?.property}: ${result.message}`;
        },
      },
    }),
  );
}
