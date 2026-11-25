import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListContractStatusHistoryRequestDto,
  ListContractsRequestDto,
} from './list-contracts-request.dto';
import { describe, expect, it } from 'vitest';

describe('ListContractsRequestDto', () => {
  it('uses the shared pagination defaults', async () => {
    const dto = plainToInstance(ListContractsRequestDto, {});

    expect(dto).toMatchObject({ page: 1, limit: 20, includeDeleted: false });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('accepts allowlisted sort fields and directions', async () => {
    const dto = plainToInstance(ListContractsRequestDto, {
      sortBy: 'title',
      sortOrder: 'ASC',
      page: '2',
      limit: '10',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['sortBy', 'createdByCompanyId'],
    ['sortBy', 'contract.id; DROP TABLE contract'],
    ['sortOrder', 'asc'],
    ['limit', '101'],
  ])('rejects %s=%s', async (property, value) => {
    const errors = await validate(
      plainToInstance(ListContractsRequestDto, { [property]: value }),
    );

    expect(errors.map((error) => error.property)).toEqual([property]);
  });
});

describe('ListContractStatusHistoryRequestDto', () => {
  it('uses the shared pagination defaults', async () => {
    const dto = plainToInstance(ListContractStatusHistoryRequestDto, {});

    expect(dto).toMatchObject({ page: 1, limit: 20 });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects a userId that is not a ULID', async () => {
    const errors = await validate(
      plainToInstance(ListContractStatusHistoryRequestDto, {
        userId: '0b1e3b9c-4f2a-4c1e-9a61-2f8d7c1b5e10',
      }),
    );
    expect(errors.map((error) => error.property)).toEqual(['userId']);
  });
});

describe.each<[string, new () => object]>([
  ['ListContractsRequestDto', ListContractsRequestDto],
  ['ListContractStatusHistoryRequestDto', ListContractStatusHistoryRequestDto],
])('%s status filter', (_name, Dto) => {
  it.each(['draft', 'active', 'suspended', 'completed'])(
    'accepts the contract status %s',
    async (status) => {
      await expect(validate(plainToInstance(Dto, { status }))).resolves.toEqual(
        [],
      );
    },
  );

  // Archiving is `deleted_at`, never a status; the others were never used.
  it.each(['archived', 'cancelled', 'under_review', 'pending_signature'])(
    'rejects %s, which is not a contract status',
    async (status) => {
      const errors = await validate(plainToInstance(Dto, { status }));
      expect(errors.map((error) => error.property)).toEqual(['status']);
    },
  );
});
