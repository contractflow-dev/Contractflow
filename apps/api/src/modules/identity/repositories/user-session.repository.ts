import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import { UserSession } from '../entities/user-session.entity';

@Injectable()
export class UserSessionRepository extends BaseRepository<UserSession> {
  constructor(
    @InjectRepository(UserSession) repository: Repository<UserSession>,
  ) {
    super(repository);
  }
}
