import { BadRequestException } from '@nestjs/common';
import type {
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { BaseRepository } from './base.repository';
import type {
  ICompanyScope,
  ICompanyScopedEntity,
} from './company-scope.interface';

/**
 * `companyId` is an explicit argument, never read from ambient request
 * context, so a missing context can't fail open and return every tenant's rows.
 */
export abstract class CompanyScopedRepository<
  Entity extends ObjectLiteral & ICompanyScopedEntity,
  Scope extends ICompanyScope = ICompanyScope,
> extends BaseRepository<Entity, Scope> {
  protected override applyScope(
    qb: SelectQueryBuilder<Entity>,
    scope: Scope,
  ): void {
    qb.andWhere(`${qb.alias}.companyId = :__scopeCompanyId`, {
      __scopeCompanyId: requireCompanyId(scope),
    });
  }

  protected override scopeWhere(scope: Scope): FindOptionsWhere<Entity> {
    return { companyId: requireCompanyId(scope) } as FindOptionsWhere<Entity>;
  }

  protected override scopeValues(scope: Scope): DeepPartial<Entity> {
    return { companyId: requireCompanyId(scope) } as DeepPartial<Entity>;
  }
}

function requireCompanyId(scope: ICompanyScope): string {
  const companyId = scope?.companyId?.trim();
  if (!companyId) {
    throw new BadRequestException('Company context is required');
  }
  return companyId;
}
