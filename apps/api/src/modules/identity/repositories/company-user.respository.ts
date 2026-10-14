import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import { CompanyUser } from '../entities/company-user.entity';

@Injectable()
export class CompanyUserRepository extends BaseRepository<CompanyUser> {
  constructor(
    @InjectRepository(CompanyUser) repository: Repository<CompanyUser>,
  ) {
    super(repository);
  }
  async findById(id: string): Promise<CompanyUser | null> {
    return this.repository.findOne({ where: { id } });
  }
}
