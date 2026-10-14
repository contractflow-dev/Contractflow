import { NotFoundException } from '@nestjs/common';
import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { IBaseRepository } from './base.repository.interface';

export abstract class BaseRepository<
  T extends ObjectLiteral & { id: string },
  Scope = void,
> implements IBaseRepository<T, Scope> {
  constructor(protected readonly repository: Repository<T>) {}

  // ---------------------------------------------------------------------
  // Scope hooks (override in scoped subclasses)
  // ---------------------------------------------------------------------

  /** Adds tenant conditions to query-builder queries. */
  protected applyScope(_qb: SelectQueryBuilder<T>, _scope: Scope): void {}

  /** Tenant conditions merged into find / update / delete conditions. */
  protected scopeWhere(_scope: Scope): FindOptionsWhere<T> {
    return {};
  }

  /** Values stamped onto rows on create/update (e.g. companyId). */
  protected scopeValues(_scope: Scope): DeepPartial<T> {
    return {} as DeepPartial<T>;
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /** Query builder with the scope already applied. Use for custom queries. */
  protected scopedQuery(scope: Scope, alias = 'e'): SelectQueryBuilder<T> {
    const qb = this.repository.createQueryBuilder(alias);
    this.applyScope(qb, scope);
    return qb;
  }

  /** Scope conditions go last so callers can't override them. */
  private withScope(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
    scope: Scope,
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const scoped = this.scopeWhere(scope);
    if (Array.isArray(where)) {
      return where.map((w) => ({ ...w, ...scoped }) as FindOptionsWhere<T>);
    }
    return { ...(where ?? {}), ...scoped } as FindOptionsWhere<T>;
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async findById(id: string, scope: Scope): Promise<T | null> {
    return this.repository.findOne({
      where: { ...this.scopeWhere(scope), id } as FindOptionsWhere<T>,
    });
  }

  async findOne(options: FindOneOptions<T>, scope: Scope): Promise<T | null> {
    return this.repository.findOne({
      ...options,
      where: this.withScope(options.where as FindOptionsWhere<T>, scope),
    });
  }

  async findAll(scope: Scope, options: FindManyOptions<T> = {}): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: this.withScope(options.where as FindOptionsWhere<T>, scope),
    });
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  /** Builds an entity (not persisted). Scope values override `data`. */
  create(data: DeepPartial<T>, scope: Scope): T {
    return this.repository.create({
      ...data,
      ...this.scopeValues(scope),
    } as DeepPartial<T>);
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  async update(
    id: string,
    data: Omit<DeepPartial<T>, 'id'>,
    scope: Scope,
  ): Promise<T> {
    const result = await this.repository.update(
      { ...this.scopeWhere(scope), id } as FindOptionsWhere<T>,
      { ...data, ...this.scopeValues(scope) } as Parameters<
        Repository<T>['update']
      >[1],
    );

    if (!result.affected) {
      throw new NotFoundException(`Entity with id ${id} not found`);
    }

    const updated = await this.findById(id, scope);
    if (!updated) {
      throw new NotFoundException(`Entity with id ${id} not found`);
    }
    return updated;
  }

  async delete(id: string, scope: Scope): Promise<void> {
    const result = await this.repository.delete({
      ...this.scopeWhere(scope),
      id,
    } as FindOptionsWhere<T>);

    if (!result.affected) {
      throw new NotFoundException(`Entity with id ${id} not found`);
    }
  }
}
