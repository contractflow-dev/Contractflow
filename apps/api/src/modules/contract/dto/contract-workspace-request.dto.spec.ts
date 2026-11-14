import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateContractRequestDto } from './create-contract-request.dto';
import {
  AddContractWorkspaceRequestDto,
  ContractWorkspaceParamDto,
  UpdateContractWorkspacesRequestDto,
} from './update-contract-workspaces-request.dto';

const failingFields = (dtoClass: new () => object, input: object) =>
  validateSync(plainToInstance(dtoClass, input), {
    whitelist: true,
  }).map(({ property }) => property);

const contract = {
  referenceNumber: 'CTR-1',
  title: 'Pipeline integrity',
  contractType: 'service',
  partyType: 'client',
  originalValueMinor: 100_000,
  currencyCode: 'NGN',
  retentionRateBps: 500,
  paymentTermsDays: 30,
  awardDate: '2026-01-01',
  startDate: '2026-01-02',
  endDate: '2027-01-01',
  defectsLiabilityDays: 365,
  timezone: 'Africa/Lagos',
};

describe('contract workspace validation', () => {
  it('accepts a contract with any set of the three workspaces, or none', () => {
    for (const workspaces of [[], ['project'], ['project', 'hse', 'finance']]) {
      expect(
        failingFields(CreateContractRequestDto, { ...contract, workspaces }),
      ).toEqual([]);
    }
  });

  it.each([
    ['a duplicate', ['project', 'project']],
    ['an unknown workspace', ['project', 'payroll']],
    ['the general area', ['general']],
    ['a non-list', 'project'],
  ])('rejects a new contract with %s', (_label, workspaces) => {
    expect(
      failingFields(CreateContractRequestDto, { ...contract, workspaces }),
    ).toEqual(['workspaces']);
  });

  it('rejects duplicates when the whole set is replaced', () => {
    expect(
      failingFields(UpdateContractWorkspacesRequestDto, {
        workspaces: ['hse', 'hse'],
      }),
    ).toEqual(['workspaces']);
  });

  it.each([AddContractWorkspaceRequestDto, ContractWorkspaceParamDto])(
    '%p accepts one known workspace only',
    (dtoClass) => {
      expect(failingFields(dtoClass, { workspace: 'finance' })).toEqual([]);
      for (const workspace of ['general', 'payroll', '', undefined]) {
        expect(failingFields(dtoClass, { workspace })).toEqual(['workspace']);
      }
    },
  );
});
