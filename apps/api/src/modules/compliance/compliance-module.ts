import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractModule } from '../contract/contract-module';
import { ComplianceController } from './controllers/compliance-controller';
import { ComplianceRequirement } from './entities/compliance-requirement.entity';
import { ComplianceRecord } from './entities/compliance-record.entity';
import { ComplianceRecordRepository } from './repositories/compliance-record.repository';
import { ComplianceRequirementRepository } from './repositories/compliance-requirement.repository';
import { ComplianceService } from './services/compliance-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComplianceRecord, ComplianceRequirement]),
    ContractModule,
  ],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    ComplianceRequirementRepository,
    ComplianceRecordRepository,
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}
