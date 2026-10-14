import type { DeepPartial, FindManyOptions, FindOneOptions } from 'typeorm';

export interface IBaseRepository<T extends { id: string }, Scope = void> {
  findById(id: string, scope: Scope): Promise<T | null>;
  findOne(options: FindOneOptions<T>, scope: Scope): Promise<T | null>;
  findAll(scope: Scope, options?: FindManyOptions<T>): Promise<T[]>;
  create(data: DeepPartial<T>, scope: Scope): T;
  save(entity: T): Promise<T>;
  update(
    id: string,
    data: Omit<DeepPartial<T>, 'id'>,
    scope: Scope,
  ): Promise<T>;
  delete(id: string, scope: Scope): Promise<void>;
}
