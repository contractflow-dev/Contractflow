import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from './entities/app-user.entity';
import { Company } from './entities/company.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';
import { CompanyUser } from './entities/company-user.entity';
import { UserSession } from './entities/user-session.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { AppUserController } from './controllers/app-user.controller';
import { AuthController } from './controllers/auth.controller';
import { CompanyController } from './controllers/company.controller';
import { AppUserRepository } from './repositories/app-user.repository';
import { AppUserService } from './services/app-user.service';
import { AuthService } from './services/auth.service';
import { CompanyService } from './services/company.service';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { MailService } from '../mail/mail.service';
import { CompanyRepository } from './repositories/company.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppUser,
      Company,
      CompanyUser,
      CompanyInvitation,
      UserSession,
      EmailVerificationToken,
    ]),
  ],
  exports: [TypeOrmModule],
  controllers: [AppUserController, AuthController, CompanyController],
  providers: [
    AppUserRepository,
    AppUserService,
    AuthService,
    CompanyService,
    CompanyRepository,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    MailService,
  ],
})
export class IdentityModule {}
