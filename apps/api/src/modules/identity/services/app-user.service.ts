import { Injectable, NotFoundException } from '@nestjs/common';
import type { IGetAppUserResponse } from '@contractflow/contracts-schema';
import { AppUserRepository } from '../repositories/app-user.repository';
import { AppUserResponseDto } from '../dto/app-user/responses/app-user-resonse.dto';

@Injectable()
export class AppUserService {
  constructor(private readonly appUserRepository: AppUserRepository) {}

  async findById(id: string): Promise<IGetAppUserResponse> {
    const user = await this.appUserRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return AppUserResponseDto.fromEntity(user);
  }
}
