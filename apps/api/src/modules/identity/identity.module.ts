import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../common/database/typeorm-unit-of-work';
import { AppUser } from './entities/app-user.entity';
import { Company } from './entities/company.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';
import { CompanyUser } from './entities/company-user.entity';
import { UserSession } from './entities/user-session.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordResetService } from './services/auth/password-reset.service';
import { PasswordResetTransactionContextFactory } from './repositories/password-reset-transaction-context.factory';
import {
  PASSWORD_RESET_UNIT_OF_WORK,
  type IPasswordResetTransactionContext,
} from './interface/password-reset-persistence.interface';
import { AppUserController } from './controllers/app-user.controller';
import { AuthController } from './controllers/auth.controller';
import { CompanyController } from './controllers/company.controller';
import { CompanyInvitationController } from './controllers/company-invitation.controller';
import { AppUserRepository } from './repositories/app-user.repository';
import { EmailVerificationTokenRepository } from './repositories/email-verification-token.repository';
import { AppUserService } from './services/app-user/app-user.service';
import { AuthService } from './services/auth/auth.service';
import { PasswordService } from './services/auth/password.service';
import { SessionService } from './services/auth/session.service';
import { CompanyService } from './services/company/company.service';
import { CompanyAdminService } from './services/company/company-admin.service';
import { CompanyVerificationService } from './services/company/company-verification.service';
import { CompanyVerificationToken } from './entities/company-verification-token.entity';
import { CompanyVerificationContextFactory } from './repositories/company-verification-context.factory';
import {
  COMPANY_VERIFICATION_UNIT_OF_WORK,
  type ICompanyVerificationContext,
} from './interface/company-verification-persistence.interface';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { MailService } from '../mail/mail.service';
import { CompanyRepository } from './repositories/company.repository';
import { CompanyInvitationRepository } from './repositories/company-invitation.repository';
import { CompanyScopeService } from './services/company/company-scope.service';
import { CompanyUserRepository } from './repositories/company-user.respository';
import { CompanyCreationContextFactory } from './repositories/company-creation-context.factory';
import { CompanyAdminReadRepository } from './repositories/company-admin-read.repository';
import { CompanyAdminTransactionContextFactory } from './repositories/company-admin-transaction-context.factory';
import { UserSessionRepository } from './repositories/user-session.repository';
import { AuthTransactionContextFactory } from './repositories/auth-transaction-context.factory';
import {
  COMPANY_CREATION_UNIT_OF_WORK,
  type ICompanyCreationContext,
} from './interface/company-creation-persistence.interface';
import {
  APP_USER_REPOSITORY,
  AUTH_UNIT_OF_WORK,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
} from './interface/auth-persistence.interface';
import { USER_SESSION_REPOSITORY } from './interface/user-session-repository.interface';
import { CompanyAuditLog } from './entities/company-audit-log.entity';
import { CompanyAuditLogRepository } from './repositories/company-audit-log.repository';
import { Contract } from '../contract/entities/contract.entity';
import { ContractParty } from '../contract/entities/contract-party.entity';
import { ContractPartyRepository } from '../contract/repositories/contract-party.repository';
import {
  COMPANY_ADMIN_READ_REPOSITORY,
  COMPANY_ADMIN_UNIT_OF_WORK,
  type ICompanyAdminTransactionContext,
} from './interface/company-admin-persistence.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppUser,
      Company,
      CompanyUser,
      CompanyInvitation,
      CompanyAuditLog,
      Contract,
      ContractParty,
      UserSession,
      EmailVerificationToken,
      CompanyVerificationToken,
      PasswordResetToken,
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
    EmailVerificationTokenRepository,
    UserSessionRepository,
    CompanyAdminReadRepository,
    {
      provide: APP_USER_REPOSITORY,
      useExisting: AppUserRepository,
    },
    {
      provide: EMAIL_VERIFICATION_TOKEN_REPOSITORY,
      useExisting: EmailVerificationTokenRepository,
    },
    {
      provide: USER_SESSION_REPOSITORY,
      useExisting: UserSessionRepository,
    },
    {
      provide: AUTH_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork(dataSource, new AuthTransactionContextFactory()),
      inject: [DataSource],
    },
    {
      provide: COMPANY_CREATION_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<ICompanyCreationContext>(
          dataSource,
          new CompanyCreationContextFactory(),
        ),
      inject: [DataSource],
    },
    {
      provide: COMPANY_ADMIN_READ_REPOSITORY,
      useExisting: CompanyAdminReadRepository,
    },
    {
      provide: COMPANY_ADMIN_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<ICompanyAdminTransactionContext>(
          dataSource,
          new CompanyAdminTransactionContextFactory(),
        ),
      inject: [DataSource],
    },
    AppUserService,
    AuthService,
    PasswordService,
    SessionService,
    PasswordResetService,
    {
      provide: PASSWORD_RESET_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<IPasswordResetTransactionContext>(
          dataSource,
          new PasswordResetTransactionContextFactory(),
        ),
      inject: [DataSource],
    },
    CompanyService,
    CompanyAdminService,
    CompanyVerificationService,
    {
      provide: COMPANY_VERIFICATION_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<ICompanyVerificationContext>(
          dataSource,
          new CompanyVerificationContextFactory(),
        ),
      inject: [DataSource],
    },
    CompanyUserRepository,
    CompanyAuditLogRepository,
    CompanyRepository,
    CompanyInvitationRepository,
    CompanyScopeService,
    CompanyContextGuard,
    ContractPartyRepository,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    MailService,
  ],
  exports: [
    CompanyInvitationRepository,
    CompanyScopeService,
    CompanyContextGuard,
    CompanyService,
    CompanyUserRepository,
    CompanyAuditLogRepository,
    MailService,
  ],
})
export class IdentityModule {}
