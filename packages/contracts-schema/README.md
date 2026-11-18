# ContractFlow shared contracts

This workspace package contains TypeScript types shared by the API and web
application. Keep transport DTOs and public domain values here; keep
database entities and framework-specific validation decorators in the API.

## Structure

- `src/common`: shared API primitives.
- `src/identity`: user DTOs and identity types.
- `src/contract`: contract DTOs and types.
- `src/compliance`: compliance DTOs and types.
- `src/delivery`: delivery DTOs and types.
- `src/financial`: financial DTOs and types.
- `src/hse`: health, safety, and environment DTOs and types.
- `src/site-operations`: site operations DTOs and types.
- `src/cross-cutting`: shared documents, comments, notifications, and activity
  contracts.

Each domain exports its public types through its `index.ts` barrel and is also
available from the package root:

```ts
import type { UserDto } from "@contractflow/contracts-schema";
import type { UserStatus } from "@contractflow/contracts-schema/identity";
```

## Monetary amounts

Every monetary field ending in `Minor` uses `MinorAmount`: a whole number of
the currency's minor units (kobo, cents) as a decimal integer string, in
requests and responses alike. `"250000000"` is NGN 2,500,000.00.

- PostgreSQL stores amounts as `bigint`. A JSON number cannot hold every
  `bigint` exactly, so amounts never travel as numbers, and JSON numbers are
  rejected rather than converted.
- Amounts are canonical: digits only, an optional leading minus sign, no
  leading zeros, no decimals, exponents or spaces, and within the `bigint`
  range (`MINOR_AMOUNT_MIN` to `MINOR_AMOUNT_MAX`).
- Each field also has its own sign rule (`any`, `non-negative`, `positive`):
  a contract value can be zero, a variation's change in value can be negative.
- Every amount travels with the currency code of its record.
- Calculate with `BigInt` through `minorAmountToBigInt`, and turn results back
  into strings with `toMinorAmount`. Never use `Number()` or `parseFloat()`.
- Rates in basis points (`*Bps`), exchange rates in millionths (`*Micro`) and
  quantities in thousandths (`*Milli`) are not money and keep their own
  formats.

`validateMinorAmount` is the one check for the format; the API's
`IsMinorAmount` decorator and the web app's money helpers both use it:

```ts
import {
  validateMinorAmount,
  type MinorAmount,
} from "@contractflow/contracts-schema/money";
```
