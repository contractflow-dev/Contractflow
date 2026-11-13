import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CompanyScopedRepository } from '../../../common/database/repositories/company-scoped.repository';
import type { ICompanyScope } from '../../../common/database/repositories/company-scope.interface';
import {
  ECompanyStatus,
  EInvitationStatus,
} from '@contractflow/contracts-schema';
import { CompanyInvitation } from '../entities/company-invitation.entity';

@Injectable()
export class CompanyInvitationRepository extends CompanyScopedRepository<CompanyInvitation> {
  constructor(
    @InjectRepository(CompanyInvitation)
    repository: Repository<CompanyInvitation>,
  ) {
    super(repository);
  }

  findByStatus(scope: ICompanyScope, status: CompanyInvitation['status']) {
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
  findPendingByEmail(scope: ICompanyScope, email: string) {
    return this.scopedQuery(scope)
      .andWhere('e.email = :email AND e.status = :s', { email, s: 'PENDING' })
      .getOne();
  }

  /** PENDING invitations past their expiry; for the expiry job. */
  findExpired(scope: ICompanyScope, now: Date) {
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

  /**
   * DELIBERATELY UNSCOPED. A signed-in invitee has no company context yet:
   * these are the invitations addressed to their own verified email. Only
   * pending, unexpired invitations from active companies are returned, with
   * the company and the inviting member's user loaded for display.
   */
  findPendingForEmailUnscoped(
    email: string,
    at: Date,
  ): Promise<CompanyInvitation[]> {
    return this.pendingForEmailQuery(email, at)
      .leftJoinAndSelect('invitation.CompanyUser', 'inviter')
      .leftJoinAndSelect('inviter.user', 'inviterUser')
      .orderBy('invitation.createdAt', 'ASC')
      .addOrderBy('invitation.id', 'ASC')
      .getMany();
  }

  /** DELIBERATELY UNSCOPED; see findPendingForEmailUnscoped. */
  countPendingForEmailUnscoped(email: string, at: Date): Promise<number> {
    return this.pendingForEmailQuery(email, at).getCount();
  }

  private pendingForEmailQuery(email: string, at: Date) {
    return this.repository
      .createQueryBuilder('invitation')
      .innerJoinAndSelect('invitation.company', 'company')
      .where('invitation.email = :email', { email })
      .andWhere('invitation.status = :status', {
        status: EInvitationStatus.PENDING,
      })
      .andWhere('invitation.revokedAt IS NULL')
      .andWhere('invitation.expiresAt > :at', { at })
      .andWhere('company.status = :companyStatus', {
        companyStatus: ECompanyStatus.ACTIVE,
      });
  }
}
