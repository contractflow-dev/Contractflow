import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../common/database/typeorm-unit-of-work';
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
import { ContractWorkspaceRepository } from './repositories/contract-workspace.repository';
import { ContractLifecycleContextFactory } from './repositories/contract-lifecycle-context.factory';
import {
  CONTRACT_LIFECYCLE_UNIT_OF_WORK,
  type IContractLifecycleContext,
} from './interfaces/contract-lifecycle-persistence.interface';
import {
  CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE,
  CONTRACT_ROLE_ASSIGNMENT_UNIT_OF_WORK,
  type IContractRoleAssignmentTransactionContext,
} from './interfaces/contract-role-assignment-persistence.interface';
import {
  ContractRoleAssignmentTransactionContextFactory,
  TypeOrmContractRoleAssignmentContext,
} from './repositories/contract-role-assignment-transaction-context.factory';
import { ContractWorkspaceController } from './controllers/contract-workspace.controller';
import { ContractWorkspaceAccessService } from './services/contract-workspace-access.service';

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
    ContractWorkspaceController,
  ],
  providers: [
    ContractService,
    ContractLifecycleService,
    ContractAccessService,
    ContractRoleAssignmentService,
    ContractWorkspaceAccessService,
    ContractRepository,
    ContractPartyRepository,
    ContractRoleAssignmentRepository,
    ContractWorkspaceRepository,
    ContractStatusHistoryRepository,
    {
      provide: CONTRACT_LIFECYCLE_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<IContractLifecycleContext>(
          dataSource,
          new ContractLifecycleContextFactory(),
        ),
      inject: [DataSource],
    },
    {
      provide: CONTRACT_ROLE_ASSIGNMENT_PERSISTENCE,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmContractRoleAssignmentContext(dataSource.manager),
      inject: [DataSource],
    },
    {
      provide: CONTRACT_ROLE_ASSIGNMENT_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<IContractRoleAssignmentTransactionContext>(
          dataSource,
          new ContractRoleAssignmentTransactionContextFactory(),
        ),
      inject: [DataSource],
    },
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
