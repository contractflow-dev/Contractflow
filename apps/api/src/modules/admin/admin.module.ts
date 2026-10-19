import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../identity/entities/company.entity';
import { AppUser } from '../identity/entities/app-user.entity';
import { Contract } from '../contract/entities/contract.entity';
import { CompanyInvitation } from '../identity/entities/company-invitation.entity';
import { ActivityLog } from '../cross-cutting/entities/activity-log.entity';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { AdminOverviewController } from './controllers/admin-overview.controller';
import { AdminOverviewService } from './services/admin-overview.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      AppUser,
      Contract,
      CompanyInvitation,
      ActivityLog,
    ]),
  ],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService, PlatformAdminGuard],
  exports: [AdminOverviewService],
})
export class AdminModule {}
