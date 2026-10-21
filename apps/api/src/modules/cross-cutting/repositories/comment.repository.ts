import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Comment } from '../entities/comment.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class CommentRepository extends ContractScopedRepository<Comment> {
  constructor(@InjectRepository(Comment) repository: Repository<Comment>) {
    super(repository);
  }

  /**
   * Comments on one entity (milestone, variation, ...). OWNER_COMPANY_ONLY
   * comments are returned only when `includeOwnerOnly` is true; the service
   * decides that from the viewer's company, never from client input.
   */
  findByEntity(
    entityType: Comment['entityType'],
    entityId: string,
    scope: IContractScope,
    includeOwnerOnly = false,
  ) {
    const qb = this.scopedQuery(scope)
      .andWhere('e.entityType = :entityType AND e.entityId = :entityId', {
        entityType,
        entityId,
      })
      .orderBy('e.createdAt', 'ASC');
    if (!includeOwnerOnly) {
      qb.andWhere('e.visibility = :v', { v: 'ALL_PARTIES' });
    }
    return qb.getMany();
  }

  findReplies(parentCommentId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { parentCommentId } as FindOptionsWhere<Comment>,
      order: { createdAt: 'ASC' } as any,
    });
  }
}
