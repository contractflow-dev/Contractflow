import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import { AppUser } from '../entities/app-user.entity';

@Injectable()
export class AppUserRepository extends BaseRepository<AppUser> {
  constructor(
    @InjectRepository(AppUser) repository: Repository<AppUser>,
  ) {
    super(repository);
  }

  async findByEmail(email: string): Promise<AppUser | null> {
    return this.repository.findOne({ where: { email } });
  }
}
