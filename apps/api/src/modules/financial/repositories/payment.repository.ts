import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentRepository extends ContractScopedRepository<Payment> {
  constructor(@InjectRepository(Payment) repository: Repository<Payment>) {
    super(repository);
  }
}
