import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Conversation } from '../entities/conversation.entity';

@Injectable()
export class ConversationRepository extends ContractScopedRepository<Conversation> {
  constructor(
    @InjectRepository(Conversation) repository: Repository<Conversation>,
  ) {
    super(repository);
  }
}
