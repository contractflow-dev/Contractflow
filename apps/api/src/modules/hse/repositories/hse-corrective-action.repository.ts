import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { HseCorrectiveAction } from '../entities/hse-corrective-action.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class HseCorrectiveActionRepository extends ContractScopedRepository<HseCorrectiveAction> {
  constructor(
    @InjectRepository(HseCorrectiveAction)
    repository: Repository<HseCorrectiveAction>,
  ) {
    super(repository);
  }

  findByIncident(hseIncidentId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { hseIncidentId } as FindOptionsWhere<HseCorrectiveAction>,
    });
  }

  findByFinding(hseInspectionFindingId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: {
        hseInspectionFindingId,
      } as FindOptionsWhere<HseCorrectiveAction>,
    });
  }

  findByAssignee(assignedToCompanyUserId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: {
        assignedToCompanyUserId,
      } as FindOptionsWhere<HseCorrectiveAction>,
      order: { dueDate: 'ASC' } as any,
    });
  }

  findOpen(scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.status IN (:...open)', { open: ['OPEN', 'IN_PROGRESS'] })
      .orderBy('e.dueDate', 'ASC')
      .getMany();
  }

  findOverdue(today: string, scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.status IN (:...open)', { open: ['OPEN', 'IN_PROGRESS'] })
      .andWhere('e.dueDate < :today', { today })
      .orderBy('e.dueDate', 'ASC')
      .getMany();
  }

  /** Completed but not yet verified by a second person. */
  findAwaitingVerification(scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.completedAt IS NOT NULL')
      .andWhere('e.verifiedAt IS NULL')
      .getMany();
  }
}
