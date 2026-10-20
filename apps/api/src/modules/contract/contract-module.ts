import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractController } from './controllers/contract-controller';
import { Contract } from './entities/contract.entity';
import { ContractParty } from './entities/contract-party.entity';
import { ContractRoleAssignment } from './entities/contract-role-assignment.entity';
import { ContractStatusHistory } from './entities/contract-status-history.entity';
import { ContractStatusHistoryRepository } from './repositories/contract-status-history.repository';
import { ContractService } from './services/contract.service';
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
      ContractRoleAssignment,
      ContractStatusHistory,
      Company,
      CompanyUser,
    ]),
    IdentityModule,
  ],
  controllers: [ContractController],
  providers: [
    ContractService,
    ContractAccessService,
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
