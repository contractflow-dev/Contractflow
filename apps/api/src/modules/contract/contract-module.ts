import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractController } from './controllers/contract-controller';
import { Contract } from './entities/contract.entity';
import { ContractParty } from './entities/contract-party.entity';
import { ContractRoleAssignment } from './entities/contract-role-assignment.entity';
import { Company } from '../identity/entities/company.entity';
import { CompanyUser } from '../identity/entities/company-user.entity';
import { IdentityModule } from '../identity/identity.module';
import { ContractPartyRepository } from './repositories/contract-party.repository';
import { ContractRoleAssignmentRepository } from './repositories/contract-role-assignment.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      ContractParty,
      ContractRoleAssignment,
      Company,
      CompanyUser,
    ]),
    IdentityModule,
  ],
  controllers: [ContractController],
  providers: [ContractPartyRepository, ContractRoleAssignmentRepository],
  exports: [ContractPartyRepository, ContractRoleAssignmentRepository],
})
export class ContractModule {}
