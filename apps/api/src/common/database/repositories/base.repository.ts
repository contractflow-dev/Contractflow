import {
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { IBaseRepository } from './base.repository.interface';
import { NotFoundException } from '@nestjs/common';

export abstract class BaseRepository<
  T extends { id: string },
> implements IBaseRepository<T> {
  constructor(protected readonly repository: Repository<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
    });
  }

  async findOne(options: FindOneOptions): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async findAll(options: FindManyOptions): Promise<T[]> {
    return this.repository.find(options);
  }

  create(data: Partial<T>): T {
    return this.repository.create(data as T);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    await this.repository.update(id, data as any);

    const updated = await this.findById(id);

    if (!updated) {
      throw new NotFoundException('Entity with ${id} not found');
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
