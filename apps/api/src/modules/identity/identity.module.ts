import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from './entities/app-user.entity';
import { Company } from './entities/company.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';
import { CompanyUser } from './entities/company-user.entity';
import { UserSession } from './entities/user-session.entity';
import { AppUserController } from './controllers/app-user.controller';
import { AppUserRepository } from './repositories/app-user.repository';
import { AppUserService } from './services/app-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppUser,
      Company,
      CompanyUser,
      CompanyInvitation,
      UserSession,
    ]),
  ],
  exports: [TypeOrmModule],
  controllers: [AppUserController],
  providers: [AppUserRepository, AppUserService],
})
export class IdentityModule {}
