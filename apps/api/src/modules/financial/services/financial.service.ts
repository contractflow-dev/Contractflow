import { Injectable } from '@nestjs/common';
import type {
  Invoice as InvoiceResponse,
  Payment as PaymentResponse,
} from '@contractflow/contracts-schema';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import {
  toInvoiceResponse,
  toPaymentResponse,
} from '../dto/financial-response.dto';
import type { Invoice } from '../entities/invoice.entity';
import type { Payment } from '../entities/payment.entity';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PaymentRepository } from '../repositories/payment.repository';

@Injectable()
export class FinancialService {
  readonly invoices: ContractResourceReader<Invoice, InvoiceResponse>;
  readonly payments: ContractResourceReader<Payment, PaymentResponse>;

  constructor(
    access: ContractAccessService,
    invoices: InvoiceRepository,
    payments: PaymentRepository,
  ) {
    this.invoices = new ContractResourceReader(
      access,
      invoices,
      'finance',
      'Invoice',
      toInvoiceResponse,
    );
    this.payments = new ContractResourceReader(
      access,
      payments,
      'finance',
      'Payment',
      toPaymentResponse,
    );
  }
}
