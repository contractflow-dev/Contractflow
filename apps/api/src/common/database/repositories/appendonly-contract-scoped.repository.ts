import { ForbiddenException, Scope } from '@nestjs/common';
import { ContractScopedRepository } from './contract-scoped.repository';
import { IContractScope } from './contract-scope.interface';

export abstract class AppendOnlyContractScopedRepository<
  Entity extends { id: string; contractId: string },
  Scope extends IContractScope = IContractScope,
> extends ContractScopedRepository<Entity, Scope> {
  override async update(): Promise<never> {
    throw new ForbiddenException('This record type is append-only');
  }

  override async delete(): Promise<never> {
    throw new ForbiddenException('This record type is append-only');
  }
}
