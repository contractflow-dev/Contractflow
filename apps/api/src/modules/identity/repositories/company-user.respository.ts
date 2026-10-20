import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyUser } from '../entities/company-user.entity';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';

@Injectable()
export class CompanyUserRepository extends CompanyScopedRepository<
  CompanyUser,
  ICompanyScope
> {
  constructor(
    @InjectRepository(CompanyUser) repository: Repository<CompanyUser>,
  ) {
    super(repository);
  }
  async findById(
    id: string,
    scope: ICompanyScope,
  ): Promise<CompanyUser | null> {
    return this.scopedQuery(scope).andWhere('entity.id =:id', { id }).getOne();
  }
}
