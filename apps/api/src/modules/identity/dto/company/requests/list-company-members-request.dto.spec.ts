import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ECompanyMemberSortField,
  ECompanyRole,
  ESortOrder,
} from '@contractflow/contracts-schema';
import { ListCompanyMembersRequestDto } from './list-company-members-request.dto';

function validate(query: Record<string, unknown>) {
  const dto = plainToInstance(ListCompanyMembersRequestDto, query);
  return { dto, errors: validateSync(dto, { whitelist: true }) };
}

describe('ListCompanyMembersRequestDto', () => {
  it('accepts a company-role filter and a known sort', () => {
    const { dto, errors } = validate({
      companyRole: ECompanyRole.COMPANY_ADMIN,
      sortBy: ECompanyMemberSortField.NAME,
      sortOrder: ESortOrder.ASC,
    });

    expect(errors).toEqual([]);
    expect(dto).toMatchObject({
      companyRole: ECompanyRole.COMPANY_ADMIN,
      sortBy: 'name',
      sortOrder: 'ASC',
    });
  });

  it.each([
    // A contract role is not a company role.
    ['companyRole', 'HSE Officer'],
    ['companyRole', 'Owner'],
    // Only known fields can reach ORDER BY.
    ['sortBy', 'passwordHash'],
    ['sortBy', 'membership.id; DROP TABLE company_user'],
    ['sortOrder', 'asc'],
  ])('rejects %s=%j', (field, value) => {
    const { errors } = validate({ [field]: value });

    expect(errors.map((error) => error.property)).toEqual([field]);
  });
});
