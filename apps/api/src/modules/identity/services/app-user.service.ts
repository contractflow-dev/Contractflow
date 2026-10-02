import { Injectable, NotFoundException, Options } from '@nestjs/common';
import { AppUserRepository } from '../repositories/app-user.repository';
import { IGetAppUserResponseDto } from '../dto/app-user/responses/get-app-user-response.interface';

@Injectable()
export class AppUserService {
  constructor(private readonly appUserRepository: AppUserRepository) {}
  async findByEmail(email: String): Promise<IGetAppUserResponseDto> {
    const user = await this.appUserRepository.findByEmail(email as string);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    return {
      email: user.email,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      status: user.status,
      timezone: user.timezone,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
