import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { CompanyAuditLog } from '../entities/company-audit-log.entity';

/** Append-only trail of administrative actions within one company. */
@Injectable()
export class CompanyAuditLogRepository extends CompanyScopedRepository<
  CompanyAuditLog,
  ICompanyScope
> {
  constructor(
    @InjectRepository(CompanyAuditLog)
    repository: Repository<CompanyAuditLog>,
  ) {
    super(repository);
  }

  async append(
    data: DeepPartial<CompanyAuditLog>,
    scope: ICompanyScope,
  ): Promise<CompanyAuditLog> {
    return this.save(this.create(data, scope), scope);
  }

  override async update(): Promise<CompanyAuditLog> {
    throw new ForbiddenException('Audit logs are immutable');
  }

  override async delete(): Promise<void> {
    throw new ForbiddenException('Audit logs are immutable');
  }
}
