import { Injectable } from '@nestjs/common';
import { AppUser } from '../../entities/app-user.entity';
import { AppUserRepository } from '../../repositories/app-user.repository';

@Injectable()
export class AppUserService {
  constructor(private readonly users: AppUserRepository) {}

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  getById(id: string): Promise<AppUser> {
    return this.users.findByIdOrFail(undefined, id);
  }

  getByEmail(email: string): Promise<AppUser> {
    return this.users.findByEmailOrFail(email);
  }
}
