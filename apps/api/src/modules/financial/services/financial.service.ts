import { Injectable } from '@nestjs/common';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PaymentRepository } from '../repositories/payment.repository';

@Injectable()
export class FinancialService {
  readonly invoices: ContractResourceReader<Invoice>;
  readonly payments: ContractResourceReader<Payment>;

  constructor(
    access: ContractAccessService,
    invoices: InvoiceRepository,
    payments: PaymentRepository,
  ) {
    this.invoices = new ContractResourceReader(access, invoices, 'finance', 'Invoice');
    this.payments = new ContractResourceReader(access, payments, 'finance', 'Payment');
  }
}
