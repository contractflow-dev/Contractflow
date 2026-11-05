import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';
import { describe, expect, it } from 'vitest';

function fromQuery(query: Record<string, string>): PaginationQueryDto {
  return plainToInstance(PaginationQueryDto, query);
}

describe('PaginationQueryDto', () => {
  it('defaults to the first page of 20 records', async () => {
    const dto = fromQuery({});

    expect(dto).toMatchObject({ page: 1, limit: 20 });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('converts query-string values to numbers', async () => {
    const dto = fromQuery({ page: '3', limit: '50' });

    expect(dto).toMatchObject({ page: 3, limit: 50 });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('accepts the maximum page size', async () => {
    await expect(validate(fromQuery({ limit: '100' }))).resolves.toEqual([]);
  });

  it.each(['0', '-1', '1.5', 'abc'])('rejects page=%s', async (page) => {
    const errors = await validate(fromQuery({ page }));

    expect(errors.map(({ property }) => property)).toEqual(['page']);
  });

  it.each(['0', '-5', '101', '2.5', 'all'])(
    'rejects limit=%s',
    async (limit) => {
      const errors = await validate(fromQuery({ limit }));

      expect(errors.map(({ property }) => property)).toEqual(['limit']);
    },
  );
});
