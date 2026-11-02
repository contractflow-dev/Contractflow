import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { ContractParty } from '../../../modules/contract/entities/contract-party.entity';
import { CompanyScopedRepository } from './company-scoped.repository';
import type {
  IContractScope,
  IContractScopedEntity,
} from './contract-scope.interface';

interface ResolvedContractScope {
  contractId: string;
  companyId?: string;
}

/**
 * Restricts every read and write to one contract. It supplies the data
 * boundary only: callers must already have authorized the user (company
 * membership, contract role assignment) before using it, and a contract id
 * from the client is never proof of access.
 *
 * When `scope.companyId` is set, that company must be a `ContractParty` of the
 * contract. A missing or blank scope throws instead of widening the query.
 */
export abstract class ContractScopedRepository<
  Entity extends ObjectLiteral & IContractScopedEntity,
  Scope extends IContractScope = IContractScope,
> extends CompanyScopedRepository<Entity, Scope> {
  /** Set to true when operations on this entity must name a party company. */
  protected readonly requireCompany: boolean = false;

  /** Property holding the owning company, for entities that store one. */
  protected readonly companyProperty?: string;

  protected resolveScope(scope: Scope): ResolvedContractScope {
    const contractId = scope?.contractId?.trim();
    if (!contractId) {
      throw new BadRequestException('Contract context is required');
    }

    let companyId: string | undefined;
    if (scope.companyId !== undefined) {
      companyId = scope.companyId.trim();
      if (!companyId) {
        throw new BadRequestException('Company context must not be blank');
      }
    }
    if (this.requireCompany && !companyId) {
      throw new BadRequestException('Company context is required');
    }
    return { contractId, companyId };
  }

  /** Verifies the company is a party to the contract before any operation. */
  protected async assertScope(scope: Scope): Promise<ResolvedContractScope> {
    const resolved = this.resolveScope(scope);
    if (resolved.companyId) {
      const isParty = await this.repository.manager
        .getRepository(ContractParty)
        .exists({
          where: {
            contractId: resolved.contractId,
            companyId: resolved.companyId,
          },
        });
      if (!isParty) {
        throw new NotFoundException('Contract was not found');
      }
    }
    return resolved;
  }

  protected override applyScope(
    scope: Scope,
    qb: SelectQueryBuilder<Entity>,
  ): void {
    const { contractId, companyId } = this.resolveScope(scope);
    qb.andWhere(`${qb.alias}.contractId = :__scopeContractId`, {
      __scopeContractId: contractId,
    });

    if (!companyId) return;

    const partyQuery = qb
      .subQuery()
      .select('1')
      .from(ContractParty, 'scope_party')
      .where('scope_party.contractId = :__scopeContractId')
      .andWhere('scope_party.companyId = :__scopeCompanyId')
      .getQuery();
    qb.andWhere(`EXISTS ${partyQuery}`, { __scopeCompanyId: companyId });

    if (this.companyProperty) {
      qb.andWhere(`${qb.alias}.${this.companyProperty} = :__scopeCompanyId`);
    }
  }

  protected override scopeWhere(scope: Scope): FindOptionsWhere<Entity> {
    const { contractId, companyId } = this.resolveScope(scope);
    const where: Record<string, string> = { contractId };
    if (companyId && this.companyProperty) {
      where[this.companyProperty] = companyId;
    }
    return where as FindOptionsWhere<Entity>;
  }

  protected override scopeValues(scope: Scope): DeepPartial<Entity> {
    return this.scopeWhere(scope) as DeepPartial<Entity>;
  }

  /** Scope conditions go last so callers' filters can't override them. */
  private mergeWhere(
    where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[] | undefined,
    scope: Scope,
  ): FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[] {
    const scoped = this.scopeWhere(scope);
    if (Array.isArray(where)) {
      return where.map(
        (w) => ({ ...w, ...scoped }) as FindOptionsWhere<Entity>,
      );
    }
    return { ...where, ...scoped } as FindOptionsWhere<Entity>;
  }

  /** Query builder with contract (and company) scope already applied. */
  async createScopedQueryBuilder(
    scope: Scope,
    alias = 'e',
  ): Promise<SelectQueryBuilder<Entity>> {
    await this.assertScope(scope);
    return this.scopedQuery(scope, alias);
  }

  override async findByIds(
    scope: Scope,
    ids: string[],
    options: Omit<FindManyOptions<Entity>, 'where'> = {},
  ): Promise<Entity[]> {
    await this.assertScope(scope);
    return super.findByIds(scope, ids, options);
  }

  override async findById(scope: Scope, id: string): Promise<Entity | null> {
    await this.assertScope(scope);
    return super.findById(scope, id);
  }

  override async exists(
    scope: Scope,
    where?: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
  ): Promise<boolean> {
    await this.assertScope(scope);
    return super.exists(scope, where);
  }

  override async existsById(scope: Scope, id: string): Promise<boolean> {
    await this.assertScope(scope);
    return super.existsById(scope, id);
  }

  override async findOne(
    scope: Scope,
    options: FindOneOptions<Entity>,
  ): Promise<Entity | null> {
    await this.assertScope(scope);
    return super.findOne(scope, options);
  }

  override async findAll(
    scope: Scope,
    options: FindManyOptions<Entity> = {},
  ): Promise<Entity[]> {
    await this.assertScope(scope);
    return super.findAll(scope, options);
  }

  override async findPage(
    scope: Scope,
    options: FindManyOptions<Entity> = {},
  ): Promise<{ items: Entity[]; total: number }> {
    await this.assertScope(scope);
    return super.findPage(scope, options);
  }

  async count(
    scope: Scope,
    where?: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[],
  ): Promise<number> {
    await this.assertScope(scope);
    return this.repository.count({ where: this.mergeWhere(where, scope) });
  }

  /** Creates a new record under the contract; existing records use update. */
  override async save(scope: Scope, entity: Entity): Promise<Entity> {
    const { contractId, companyId } = await this.assertScope(scope);
    if (entity.id?.trim()) {
      throw new BadRequestException(
        'Scoped save only creates new records; use update for existing records',
      );
    }
    if (entity.contractId && entity.contractId !== contractId) {
      throw new BadRequestException(
        'Record belongs to a different contract than the scope',
      );
    }
    if (this.companyProperty) {
      const rowCompanyId = Object.getOwnPropertyDescriptor(
        entity,
        this.companyProperty,
      )?.value;
      if (rowCompanyId !== undefined && rowCompanyId !== companyId) {
        throw new BadRequestException(
          'Record belongs to a different company than the scope',
        );
      }
    }

    const scopedEntity = this.repository.create({
      ...entity,
      ...this.scopeValues(scope),
    } as DeepPartial<Entity>);
    return this.repository.save(scopedEntity);
  }

  override async saveMany(scope: Scope, entities: Entity[]): Promise<Entity[]> {
    if (!entities.length) return [];

    const { contractId, companyId } = await this.assertScope(scope);
    for (const entity of entities) {
      if (entity.id?.trim()) {
        throw new BadRequestException(
          'Scoped save only creates new records; use update for existing records',
        );
      }
      if (entity.contractId && entity.contractId !== contractId) {
        throw new BadRequestException(
          'Record belongs to a different contract than the scope',
        );
      }
      if (this.companyProperty) {
        const rowCompanyId = Object.getOwnPropertyDescriptor(
          entity,
          this.companyProperty,
        )?.value;
        if (rowCompanyId !== undefined && rowCompanyId !== companyId) {
          throw new BadRequestException(
            'Record belongs to a different company than the scope',
          );
        }
      }
    }

    const values = this.scopeValues(scope);
    const scopedEntities = entities.map((entity) =>
      this.repository.create({ ...entity, ...values } as DeepPartial<Entity>),
    );
    return this.repository.manager.transaction((manager) =>
      manager.save(scopedEntities),
    );
  }

  override async update(
    scope: Scope,
    id: string,
    data: Omit<DeepPartial<Entity>, 'id'>,
  ): Promise<Entity> {
    await this.assertScope(scope);
    return super.update(scope, id, data);
  }

  override async updateMany(
    scope: Scope,
    where: FindOptionsWhere<Entity>,
    data: Omit<DeepPartial<Entity>, 'id'>,
  ): Promise<number> {
    await this.assertScope(scope);
    return super.updateMany(scope, where, data);
  }

  override async delete(scope: Scope, id: string): Promise<void> {
    await this.assertScope(scope);
    return super.delete(scope, id);
  }

  override async deleteMany(
    scope: Scope,
    where: FindOptionsWhere<Entity>,
  ): Promise<number> {
    await this.assertScope(scope);
    return super.deleteMany(scope, where);
  }

  override async softDelete(scope: Scope, id: string): Promise<void> {
    await this.assertScope(scope);
    return super.softDelete(scope, id);
  }

  override async restore(scope: Scope, id: string): Promise<void> {
    await this.assertScope(scope);
    return super.restore(scope, id);
  }
}
