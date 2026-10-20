import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ECompanyUserStatus } from '@contractflow/contracts-schema';
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
  /** The user's current membership of the scoped company, or null. */
  async findActiveMember(
    userId: string,
    scope: ICompanyScope,
  ): Promise<CompanyUser | null> {
    return this.findOne(
      {
        where: {
          userId,
          status: ECompanyUserStatus.ACTIVE,
          leftAt: IsNull(),
        },
      },
      scope,
    );
  }
}
