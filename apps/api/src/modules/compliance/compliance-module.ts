import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceController } from './controllers/compliance-controller';
import { ComplianceRequirement } from './entities/compliance-requirement.entity';
import { ComplianceRecord } from './entities/compliance-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComplianceRecord, ComplianceRequirement]),
  ],
  controllers: [ComplianceController],
  providers: [],
  exports: [ComplianceController],
})
export class ComplianceModule {}
