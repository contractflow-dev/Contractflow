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
} from './company-scope.interface';

/**
 * `companyId` is an explicit argument, never read from ambient request
 * context, so a missing context can't fail open and return every tenant's rows.
 *
 * Subclasses whose rows carry no `companyId` column (for example
 * `ContractScopedRepository`) override the scope hooks. A direct subclass must
 * have a `companyId` property, since the default hooks filter on it.
 */
export abstract class CompanyScopedRepository<
  Entity extends ObjectLiteral & { id: string },
  Scope extends { companyId?: string } = ICompanyScope,
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
    return {
      companyId: requireCompanyId(scope),
    } as unknown as FindOptionsWhere<Entity>;
  }

  protected override scopeValues(scope: Scope): DeepPartial<Entity> {
    return {
      companyId: requireCompanyId(scope),
    } as unknown as DeepPartial<Entity>;
  }

  override async save(entity: Entity, scope: Scope): Promise<Entity> {
    if (entity.id?.trim()) {
      throw new BadRequestException(
        'Scoped save only creates new records; use update for existing records',
      );
    }

    const scopedEntity = this.repository.create({
      ...entity,
      ...this.scopeValues(scope),
    } as DeepPartial<Entity>);
    return this.repository.save(scopedEntity);
  }
}

function requireCompanyId(scope: { companyId?: string }): string {
  const companyId = scope?.companyId?.trim();
  if (!companyId) {
    throw new BadRequestException('Company context is required');
  }
  return companyId;
}
