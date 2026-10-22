import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Payment } from '../entities/payment.entity';
import { sumBigint } from '../../../common/database/utils/sum-bigint';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';

@Injectable()
export class PaymentRepository extends ContractScopedRepository<Payment> {
  constructor(@InjectRepository(Payment) repository: Repository<Payment>) {
    super(repository);
  }

  findByInvoice(invoiceId: string, scope: IContractScope) {
    return this.findAll(scope, {
      where: { invoiceId } as FindOptionsWhere<Payment>,
      order: { paymentDate: 'ASC' } as any,
    });
  }

  findByReference(paymentReference: string, scope: IContractScope) {
    return this.findOne(
      { where: { paymentReference } as FindOptionsWhere<Payment> },
      scope,
    );
  }

  /** Idempotent create: look up before inserting a retried request. */
  findByIdempotencyKey(idempotencyKey: string, scope: IContractScope) {
    return this.findOne(
      { where: { idempotencyKey } as FindOptionsWhere<Payment> },
      scope,
    );
  }

  findByStatus(status: Payment['status'], scope: IContractScope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<Payment>,
    });
  }

  /** Recorded but not yet approved. */
  findAwaitingApproval(scope: IContractScope) {
    return this.scopedQuery(scope)
      .andWhere('e.approvedAt IS NULL')
      .andWhere('e.status = :s', { s: 'PENDING' })
      .getMany();
  }

  /** Feeds invoice.amount_paid_minor: COMPLETED payments in the invoice's currency. */
  completedAmountForInvoice(
    invoiceId: string,
    scope: IContractScope,
  ): Promise<bigint> {
    return sumBigint(
      this.scopedQuery(scope)
        .andWhere('e.invoiceId = :invoiceId', { invoiceId })
        .andWhere('e.status = :s', { s: 'COMPLETED' }),
      'e.invoiceAmountMinor',
    );
  }
}
