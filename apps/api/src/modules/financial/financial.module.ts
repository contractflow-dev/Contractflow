import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractModule } from '../contract/contract-module';
import { FinancialController } from './controllers/financial.controller';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { InvoiceRepository } from './repositories/invoice.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { FinancialService } from './services/financial.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Payment]), ContractModule],
  controllers: [FinancialController],
  providers: [FinancialService, InvoiceRepository, PaymentRepository],
  exports: [FinancialService],
})
export class FinancialModule {}
