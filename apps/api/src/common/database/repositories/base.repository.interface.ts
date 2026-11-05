import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';

export interface IBaseRepository<T extends { id: string }, Scope = void> {
  // Reads
  findById(
    scope: Scope,
    id: string,
    options?: Omit<FindOneOptions<T>, 'where'>,
  ): Promise<T | null>;

  findByIdOrFail(
    scope: Scope,
    id: string,
    options?: Omit<FindOneOptions<T>, 'where'>,
  ): Promise<T>;

  findByIds(
    scope: Scope,
    ids: string[],
    options?: Omit<FindManyOptions<T>, 'where'>,
  ): Promise<T[]>;

  findOne(scope: Scope, options: FindOneOptions<T>): Promise<T | null>;
  findOneOrFail(scope: Scope, options: FindOneOptions<T>): Promise<T>;
  findAll(scope: Scope, options?: FindManyOptions<T>): Promise<T[]>;
  findPage(
    scope: Scope,
    options?: FindManyOptions<T>,
  ): Promise<{ items: T[]; total: number }>;

  exists(
    scope: Scope,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<boolean>;
  existsById(scope: Scope, id: string): Promise<boolean>;

  count(
    scope: Scope,
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number>;

  // Writes
  create(scope: Scope, data: DeepPartial<T>): T;
  createMany(scope: Scope, data: DeepPartial<T>[]): T[];
  save(scope: Scope, entity: T): Promise<T>;
  saveMany(scope: Scope, entities: T[]): Promise<T[]>;
  update(
    scope: Scope,
    id: string,
    data: Omit<DeepPartial<T>, 'id'>,
  ): Promise<T>;
  updateMany(
    scope: Scope,
    where: FindOptionsWhere<T>,
    data: Omit<DeepPartial<T>, 'id'>,
  ): Promise<number>;

  // Deletes
  delete(scope: Scope, id: string): Promise<void>;
  deleteMany(scope: Scope, where: FindOptionsWhere<T>): Promise<number>;
  softDelete(scope: Scope, id: string): Promise<void>;
  restore(scope: Scope, id: string): Promise<void>;
}
