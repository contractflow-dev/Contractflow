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
});
