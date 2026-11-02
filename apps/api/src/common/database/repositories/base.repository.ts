import { NotFoundException } from '@nestjs/common';
import { In, LessThan, MoreThan } from 'typeorm';
import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsSelect,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { IBaseRepository } from './base.repository.interface';

type UpdateData<T> = Omit<DeepPartial<T>, 'id'>;
type RepoUpdateData<T extends ObjectLiteral> = Parameters<
  Repository<T>['update']
>[1];

export abstract class BaseRepository<
  T extends ObjectLiteral & { id: string },
  Scope = void,
> implements IBaseRepository<T, Scope> {
  constructor(protected readonly repository: Repository<T>) {}

  // ---------------------------------------------------------------------
  // Scope hooks (override in scoped subclasses)
  // ---------------------------------------------------------------------

  /** Adds tenant conditions to query-builder queries. */
  protected applyScope(_scope: Scope, _qb: SelectQueryBuilder<T>): void {}

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
    this.applyScope(scope, qb);
    return qb;
  }

  /** Scope conditions go last so callers can't override them. */
  private withScope(
    scope: Scope,
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const scoped = this.scopeWhere(scope);
    if (Array.isArray(where)) {
      return where.map((w) => ({ ...w, ...scoped }) as FindOptionsWhere<T>);
    }
    return { ...(where ?? {}), ...scoped } as FindOptionsWhere<T>;
  }

  /** Single-object variant for APIs that don't accept OR-arrays (update/delete). */
  private withScopeSingle(
    scope: Scope,
    where: FindOptionsWhere<T>,
  ): FindOptionsWhere<T> {
    return { ...where, ...this.scopeWhere(scope) } as FindOptionsWhere<T>;
  }

  private idWhere(scope: Scope, id: string): FindOptionsWhere<T> {
    return { ...this.scopeWhere(scope), id } as FindOptionsWhere<T>;
  }

  private isScoped(scope: Scope): boolean {
    return Object.keys(this.scopeWhere(scope)).length > 0;
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Entity with id ${id} not found`);
  }

  /**
   * Prevents save() from hijacking rows that belong to another scope.
   * Skipped for unscoped repositories and for brand-new entities (no id).
   */
  private async assertWritable(scope: Scope, entities: T[]): Promise<void> {
    if (!this.isScoped(scope)) return;

    const ids = entities.map((e) => e.id).filter(Boolean);
    if (!ids.length) return;

    const inScope = await this.repository.find({
      where: this.withScope(scope, { id: In(ids) } as FindOptionsWhere<T>),
      select: { id: true } as FindOptionsSelect<T>,
    });
    const inScopeIds = new Set(inScope.map((e) => e.id));
    const rest = ids.filter((id) => !inScopeIds.has(id));
    if (!rest.length) return;

    const elsewhere = await this.repository.exists({
      where: { id: In(rest) } as FindOptionsWhere<T>,
    });
    if (elsewhere) {
      throw new NotFoundException('One or more entities not found');
    }
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async findById(
    scope: Scope,
    id: string,
    options: Omit<FindOneOptions<T>, 'where'> = {},
  ): Promise<T | null> {
    return this.repository.findOne({
      ...options,
      where: this.idWhere(scope, id),
    });
  }

  async findByIdOrFail(
    scope: Scope,
    id: string,
    options: Omit<FindOneOptions<T>, 'where'> = {},
  ): Promise<T> {
    const entity = await this.findById(scope, id, options);
    if (!entity) throw this.notFound(id);
    return entity;
  }

  async findByIds(
    scope: Scope,
    ids: string[],
    options: Omit<FindManyOptions<T>, 'where'> = {},
  ): Promise<T[]> {
    if (!ids.length) return [];
    return this.repository.find({
      ...options,
      where: this.withScope(scope, { id: In(ids) } as FindOptionsWhere<T>),
    });
  }

  async findOne(scope: Scope, options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne({
      ...options,
      where: this.withScope(scope, options.where as FindOptionsWhere<T>),
    });
  }

  async findOneOrFail(scope: Scope, options: FindOneOptions<T>): Promise<T> {
    const entity = await this.findOne(scope, options);
    if (!entity) throw new NotFoundException('Entity not found');
    return entity;
  }

  async findAll(scope: Scope, options: FindManyOptions<T> = {}): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: this.withScope(scope, options.where as FindOptionsWhere<T>),
    });
  }

  async findPage(
    scope: Scope,
    options: FindManyOptions<T> = {},
  ): Promise<{ items: T[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      ...options,
      where: this.withScope(scope, options.where as FindOptionsWhere<T>),
    });

    return { items, total };
  }

  async exists(
    scope: Scope,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<boolean> {
    return this.repository.exists({ where: this.withScope(scope, where) });
  }

  async existsById(scope: Scope, id: string): Promise<boolean> {
    return this.repository.exists({ where: this.idWhere(scope, id) });
  }

  async count(
    scope: Scope,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number> {
    return this.repository.count({ where: this.withScope(scope, where) });
  }

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  /** Builds an entity (not persisted). Scope values override `data`. */
  create(scope: Scope, data: DeepPartial<T>): T {
    return this.repository.create({
      ...data,
      ...this.scopeValues(scope),
    } as DeepPartial<T>);
  }

  createMany(scope: Scope, data: DeepPartial<T>[]): T[] {
    return data.map((d) => this.create(scope, d));
  }

  /**
   * Persists an entity. Scope values are stamped onto it, and rows that
   * belong to another scope cannot be overwritten.
   */
  async save(scope: Scope, entity: T): Promise<T> {
    await this.assertWritable(scope, [entity]);
    Object.assign(entity, this.scopeValues(scope));
    return this.repository.save(entity);
  }

  async saveMany(scope: Scope, entities: T[]): Promise<T[]> {
    if (!entities.length) return [];
    await this.assertWritable(scope, entities);
    const values = this.scopeValues(scope);
    entities.forEach((e) => Object.assign(e, values));
    return this.repository.save(entities);
  }

  async update(scope: Scope, id: string, data: UpdateData<T>): Promise<T> {
    // `Omit<..., 'id'>` is compile-time only; strip it at runtime too.
    const { id: _ignored, ...rest } = data as DeepPartial<T> & { id?: string };
    const values = { ...rest, ...this.scopeValues(scope) };

    if (Object.keys(values).length === 0) {
      return this.findByIdOrFail(scope, id);
    }

    const result = await this.repository.update(
      this.idWhere(scope, id),
      values as RepoUpdateData<T>,
    );
    if (!result.affected) throw this.notFound(id);

    return this.findByIdOrFail(scope, id);
  }

  /** Updates all rows matching `where` (within scope). Returns rows affected. */
  async updateMany(
    scope: Scope,
    where: FindOptionsWhere<T>,
    data: UpdateData<T>,
  ): Promise<number> {
    const { id: _ignored, ...rest } = data as DeepPartial<T> & { id?: string };
    const values = { ...rest, ...this.scopeValues(scope) };
    if (Object.keys(values).length === 0) return 0;

    const result = await this.repository.update(
      this.withScopeSingle(scope, where),
      values as RepoUpdateData<T>,
    );
    return result.affected ?? 0;
  }

  // ---------------------------------------------------------------------
  // Deletes
  // ---------------------------------------------------------------------

  async delete(scope: Scope, id: string): Promise<void> {
    const result = await this.repository.delete(this.idWhere(scope, id));
    if (!result.affected) throw this.notFound(id);
  }

  /**
   * Deletes all rows matching `where` (within scope). Returns rows deleted.
   * An empty `where` is rejected to prevent accidental mass deletion.
   */
  async deleteMany(scope: Scope, where: FindOptionsWhere<T>): Promise<number> {
    if (!where || Object.keys(where).length === 0) {
      throw new Error('deleteMany requires a non-empty condition');
    }
    const result = await this.repository.delete(
      this.withScopeSingle(scope, where),
    );
    return result.affected ?? 0;
  }

  /** Requires a @DeleteDateColumn on the entity. */
  async softDelete(scope: Scope, id: string): Promise<void> {
    const result = await this.repository.softDelete(this.idWhere(scope, id));
    if (!result.affected) throw this.notFound(id);
  }

  /** Requires a @DeleteDateColumn on the entity. */
  async restore(scope: Scope, id: string): Promise<void> {
    const result = await this.repository.restore(this.idWhere(scope, id));
    if (!result.affected) throw this.notFound(id);
  }
}
