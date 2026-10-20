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
import { CompanyInvitationController } from './controllers/company-invitation.controller';
import { AppUserRepository } from './repositories/app-user.repository';
import { AppUserService } from './services/app-user.service';
import { AuthService } from './services/auth.service';
import { CompanyService } from './services/company.service';
import { CompanyAdminService } from './services/company-admin.service';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { MailService } from '../mail/mail.service';
import { CompanyRepository } from './repositories/company.repository';
import { CompanyInvitationRepository } from './repositories/company-invitation.repository';
import { CompanyScopeService } from './services/company-scope.service';
import { CompanyUserRepository } from './repositories/company-user.respository';
import { Contract } from '../contract/entities/contract.entity';
import { ContractParty } from '../contract/entities/contract-party.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppUser,
      Company,
      CompanyUser,
      CompanyInvitation,
      Contract,
      ContractParty,
      UserSession,
      EmailVerificationToken,
    ]),
  ],
  controllers: [
    AppUserController,
    AuthController,
    CompanyController,
    CompanyInvitationController,
  ],
  providers: [
    AppUserRepository,
    AppUserService,
    AuthService,
    CompanyService,
    CompanyAdminService,
    CompanyUserRepository,
    CompanyRepository,
    CompanyInvitationRepository,
    CompanyScopeService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    MailService,
  ],
  exports: [
    CompanyInvitationRepository,
    CompanyScopeService,
    CompanyService,
    CompanyUserRepository,
  ],
})
export class IdentityModule {}
