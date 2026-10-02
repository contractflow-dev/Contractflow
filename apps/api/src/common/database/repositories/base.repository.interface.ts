import { FindManyOptions, FindOneOptions } from 'typeorm';

export interface IBaseRepository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;

  findOne(options: FindOneOptions<T>): Promise<T | null>;

  findAll(options: FindManyOptions): Promise<T[]>;

  create(data: Partial<T>): T;

  update(id: string, data: Partial<T>): Promise<T>;

  delete(id: string): Promise<void>;
}
