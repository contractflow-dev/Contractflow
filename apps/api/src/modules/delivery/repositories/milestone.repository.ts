import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Milestone } from '../entities/milestone.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

type Scope = IContractScope;
@Injectable()
export class MilestoneRepository extends ContractScopedRepository<Milestone> {
  constructor(@InjectRepository(Milestone) repository: Repository<Milestone>) {
    super(repository);
  }

  findByStage(scope: Scope, contractStageId: string) {
    return this.findAll(scope, {
      where: { contractStageId } as FindOptionsWhere<Milestone>,
      order: { sequence: 'ASC' } as any,
    });
  }

  findByStatus(scope: Scope, status: Milestone['status']) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<Milestone>,
    });
  }

  findPaymentMilestones(scope: Scope) {
    return this.findAll(scope, {
      where: { isPaymentMilestone: true } as FindOptionsWhere<Milestone>,
      order: { sequence: 'ASC' } as any,
    });
  }

  /** Submitted and waiting for the awarding party to approve or reject. */
  findAwaitingApproval(scope: Scope) {
    return this.findAll(scope, {
      where: { status: 'SUBMITTED' } as unknown as FindOptionsWhere<Milestone>,
    });
  }

  /** Not completed and past its (revised) due date. */
  findOverdue(scope: Scope, today: string) {
    return this.scopedQuery(scope)
      .andWhere('e.completedDate IS NULL')
      .andWhere('COALESCE(e.revisedDueDate, e.dueDate) < :today', { today })
      .orderBy('COALESCE(e.revisedDueDate, e.dueDate)', 'ASC')
      .getMany();
  }
}
