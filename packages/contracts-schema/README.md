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
