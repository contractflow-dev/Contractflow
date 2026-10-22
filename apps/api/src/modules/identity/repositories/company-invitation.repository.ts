import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import { EInvitationStatus } from '@contractflow/contracts-schema';
import { CompanyInvitation } from '../entities/company-invitation.entity';

@Injectable()
export class CompanyInvitationRepository extends CompanyScopedRepository<CompanyInvitation> {
  constructor(
    @InjectRepository(CompanyInvitation)
    repository: Repository<CompanyInvitation>,
  ) {
    super(repository);
  }

  findByStatus(status: CompanyInvitation['status'], scope: ICompanyScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<CompanyInvitation>,
    });
  }

  findPending(scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s', { s: 'PENDING' })
      .orderBy('e.expiresAt', 'ASC')
      .getMany();
  }

  /** Duplicate check before sending another invite to the same address. */
  findPendingByEmail(email: string, scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.email = :email AND e.status = :s', { email, s: 'PENDING' })
      .getOne();
  }

  /** PENDING invitations past their expiry; for the expiry job. */
  findExpired(now: Date, scope: ICompanyScope) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s AND e.expiresAt < :now', { s: 'PENDING', now })
      .getMany();
  }

  countPending(scope: ICompanyScope, at = new Date()): Promise<number> {
    return this.scopedQuery(scope)
      .andWhere('e.status = :status', { status: EInvitationStatus.PENDING })
      .andWhere('e.expiresAt > :at', { at })
      .getCount();
  }

  /**
   * DELIBERATELY UNSCOPED. Accepting an invitation happens before any company
   * context exists: the invitee only holds the token. The caller must verify
   * status = PENDING and expiresAt before trusting the row, and take the
   * companyId from the returned row, never from the request.
   */
  findByTokenHashUnscoped(
    tokenHash: string,
  ): Promise<CompanyInvitation | null> {
    return this.repository.findOne({
      where: { tokenHash } as FindOptionsWhere<CompanyInvitation>,
    });
  }
}
