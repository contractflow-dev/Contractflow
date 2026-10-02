import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/database/repositories/base.repository';
import { AppUser } from '../entities/app-user';

@Injectable()
export class AppUserRepository extends BaseRepository<AppUser> {
  async findByEmail(email: string): Promise<AppUser | null> {
    return this.repository.findOne({ where: { email } });
  }
}
