import { ValidateBy } from 'class-validator';
import {
  validateMinorAmount,
  type MinorAmountSign,
} from '@contractflow/contracts-schema/money';

/**
 * A monetary amount in minor units, sent as a decimal integer string
 * (`MinorAmount`) within the PostgreSQL `bigint` range. JSON numbers are
 * rejected rather than converted, and the value is never rewritten.
 *
 * `sign` is the field's own rule: `non-negative` for values such as a contract
 * value, `positive` for amounts that must be more than zero, and `any` for
 * signed changes such as a variation's change in value.
 *
 * Combine with `@IsOptional()` for amounts that may be left out or null.
 */
export function IsMinorAmount(sign: MinorAmountSign): PropertyDecorator {
  return ValidateBy({
    name: 'isMinorAmount',
    constraints: [sign],
    validator: {
      validate: (value: unknown) => validateMinorAmount(value, { sign }).valid,
      defaultMessage: (args) => {
        const result = validateMinorAmount(args?.value, { sign });
        return result.valid ? '' : `${args?.property} ${result.message}`;
      },
    },
  });
}
