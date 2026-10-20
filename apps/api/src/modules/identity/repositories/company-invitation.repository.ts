import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { EInvitationStatus } from '@contractflow/contracts-schema';
import { CompanyInvitation } from '../entities/company-invitation.entity';

@Injectable()
export class CompanyInvitationRepository extends CompanyScopedRepository<
  CompanyInvitation,
  ICompanyScope
> {
  constructor(
    @InjectRepository(CompanyInvitation)
    repository: Repository<CompanyInvitation>,
  ) {
    super(repository);
  }

  async findByTokenHash(tokenHash: string): Promise<CompanyInvitation | null> {
    return this.repository
      .createQueryBuilder('invitation')
      .addSelect('invitation.tokenHash')
      .where('invitation.tokenHash = :tokenHash', { tokenHash })
      .getOne();
  }

  async countPending(scope: ICompanyScope, at: Date): Promise<number> {
    return this.scopedQuery(scope, 'invitation')
      .andWhere('invitation.status = :status', {
        status: EInvitationStatus.PENDING,
      })
      .andWhere('invitation.expiresAt > :at', { at })
      .getCount();
  }
}
