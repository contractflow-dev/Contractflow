import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractParty } from '../contract/entities/contract-party.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Company } from '../identity/entities/company.entity';
import { CompanyUser } from '../identity/entities/company-user.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { DocumentLink } from './entities/document-link.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { Document } from './entities/document.entity';
import { ActivityLogRepository } from './repositories/activity-log.repository';
import { DocumentRepository } from './repositories/document.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivityLog,
      Document,
      DocumentVersion,
      DocumentLink,
      Contract,
      ContractParty,
      Company,
      CompanyUser,
    ]),
  ],
  providers: [ActivityLogRepository, DocumentRepository],
  exports: [ActivityLogRepository, DocumentRepository],
})
export class CrossCuttingModule {}
