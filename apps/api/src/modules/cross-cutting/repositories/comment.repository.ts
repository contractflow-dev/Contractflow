import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContractScopedRepository } from '../../../common/database/repositories/contract-scoped.repository';
import { Comment } from '../entities/comment.entity';

@Injectable()
export class CommentRepository extends ContractScopedRepository<Comment> {
  constructor(@InjectRepository(Comment) repository: Repository<Comment>) {
    super(repository);
  }
}
