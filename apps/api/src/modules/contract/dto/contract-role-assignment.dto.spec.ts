import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { EContractorContractRole } from '@contractflow/contracts-schema';
import {
  CreateContractRoleAssignmentRequestDto,
  ListCompanyRoleAssignmentsRequestDto,
} from './contract-role-assignment.dto';

const ULID = '01JD4X2Y3Z4A5B6C7D8E9F0G1H';
const NOT_ULIDS = [
  '0b1e3b9c-4f2a-4c1e-9a61-2f8d7c1b5e10',
  'member-1',
  '8ZZZZZZZZZZZZZZZZZZZZZZZZZ',
];

describe('CreateContractRoleAssignmentRequestDto', () => {
  it('accepts a ULID company member id', async () => {
    const dto = plainToInstance(CreateContractRoleAssignmentRequestDto, {
      companyUserId: ULID,
      role: EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
    });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each(NOT_ULIDS)('rejects the member id %s', async (companyUserId) => {
    const errors = await validate(
      plainToInstance(CreateContractRoleAssignmentRequestDto, {
        companyUserId,
        role: EContractorContractRole.CONTRACTOR_PROJECT_LEAD,
      }),
    );
    expect(errors.map((error) => error.property)).toEqual(['companyUserId']);
  });
});

describe('ListCompanyRoleAssignmentsRequestDto', () => {
  it.each(NOT_ULIDS)('rejects the member filter %s', async (companyUserId) => {
    const errors = await validate(
      plainToInstance(ListCompanyRoleAssignmentsRequestDto, { companyUserId }),
    );
    expect(errors.map((error) => error.property)).toEqual(['companyUserId']);
  });
});
