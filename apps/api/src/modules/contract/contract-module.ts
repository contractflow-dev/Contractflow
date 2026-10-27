import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractController } from './controllers/contract-controller';
import { ContractRoleInvitationController } from './controllers/contract-role-invitation.controller';
import { ContractPartyInvitationController } from './controllers/contract-party-invitation.controller';
import { Contract } from './entities/contract.entity';
import { ContractParty } from './entities/contract-party.entity';
import { ContractPartyInvitation } from './entities/contract-party-invitation.entity';
import { ContractRoleAssignment } from './entities/contract-role-assignment.entity';
import { ContractRoleInvitation } from './entities/contract-role-invitation.entity';
import { ContractStatusHistory } from './entities/contract-status-history.entity';
import { ContractWorkspaceEntity } from './entities/contract-workspace.entity';
import { ActivityLog } from '../cross-cutting/entities/activity-log.entity';
import { ContractStatusHistoryRepository } from './repositories/contract-status-history.repository';
import { ContractRoleAssignmentService } from './services/contract-role-assignment.service';
import { ContractService } from './services/contract.service';
import { ContractLifecycleService } from './services/contract-lifecycle.service';
import { ContractAccessService } from './services/contract-access.service';
import { Company } from '../identity/entities/company.entity';
import { CompanyUser } from '../identity/entities/company-user.entity';
import { IdentityModule } from '../identity/identity.module';
import { ContractPartyRepository } from './repositories/contract-party.repository';
import { ContractRepository } from './repositories/contract.repository';
import { ContractRoleAssignmentRepository } from './repositories/contract-role-assignment.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractParty,
      ContractPartyInvitation,
      ContractRoleAssignment,
      ContractRoleInvitation,
      ContractStatusHistory,
      ContractWorkspaceEntity,
      ActivityLog,
      Company,
      CompanyUser,
    ]),
    IdentityModule,
  ],
  controllers: [
    ContractController,
    ContractRoleInvitationController,
    ContractPartyInvitationController,
  ],
  providers: [
    ContractService,
    ContractLifecycleService,
    ContractAccessService,
    ContractRoleAssignmentService,
    ContractRepository,
    ContractPartyRepository,
    ContractRoleAssignmentRepository,
    ContractStatusHistoryRepository,
  ],
  exports: [
    ContractAccessService,
    ContractRepository,
    ContractPartyRepository,
    ContractRoleAssignmentRepository,
    ContractStatusHistoryRepository,
  ],
})
export class ContractModule {}
