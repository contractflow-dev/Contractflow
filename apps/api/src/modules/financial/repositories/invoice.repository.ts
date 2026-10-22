import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Invoice } from '../entities/invoice.entity';
import { IContractScope } from '../../../common/database/repositories/contract-scope.interface';
import { SelectQueryBuilder } from 'typeorm/browser';
import { sumBigint } from '../../../common/database/utils/sum-bigint';

type Scope = IContractScope;

@Injectable()
export class InvoiceRepository extends ContractScopedRepository<Invoice> {
  constructor(@InjectRepository(Invoice) repository: Repository<Invoice>) {
    super(repository);
  }

  findByStatus(status: Invoice['status'], scope: Scope) {
    return this.findAll(scope, {
      where: { status } as FindOptionsWhere<Invoice>,
    });
  }

  findByInvoiceNumber(invoiceNumber: string, scope: Scope) {
    return this.findOne(
      { where: { invoiceNumber } as FindOptionsWhere<Invoice> },
      scope,
    );
  }

  findByIssuer(issuedByPartyId: string, scope: Scope) {
    return this.findAll(scope, {
      where: { issuedByPartyId } as FindOptionsWhere<Invoice>,
    });
  }

  /** Certified but not fully paid. */
  findOutstanding(scope: Scope) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s', { s: 'CERTIFIED' })
      .andWhere('e.amountPaidMinor < e.netPayableMinor')
      .orderBy('e.dueDate', 'ASC')
      .getMany();
  }

  findOverdue(today: string, scope: Scope) {
    return this.scopedQuery(scope)
      .andWhere('e.status = :s', { s: 'CERTIFIED' })
      .andWhere('e.amountPaidMinor < e.netPayableMinor')
      .andWhere('e.dueDate < :today', { today })
      .orderBy('e.dueDate', 'ASC')
      .getMany();
  }

  async billedAndPaidMinor(
    scope: Scope,
  ): Promise<{ net: bigint; paid: bigint }> {
    const base = () =>
      this.scopedQuery(scope).andWhere('e.status = :s', { s: 'CERTIFIED' });
    return {
      net: await sumBigint(base(), 'e.netPayableMinor'),
      paid: await sumBigint(base(), 'e.amountPaidMinor'),
    };
  }
}
