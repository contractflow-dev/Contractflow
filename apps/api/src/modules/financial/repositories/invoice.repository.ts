import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class InvoiceRepository extends ContractScopedRepository<Invoice> {
  constructor(@InjectRepository(Invoice) repository: Repository<Invoice>) {
    super(repository);
  }
}
