import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractModule } from '../contract/contract-module';
import { HseController } from './controllers/hse.controller';
import { HseCorrectiveAction } from './entities/hse-corrective-action.entity';
import { HseIncident } from './entities/hse-incident.entity';
import { HseInspection } from './entities/hse-inspection.entity';
import { HseInspectionFinding } from './entities/hse-inspection-finding.entity'; // add
import { HseCorrectiveActionRepository } from './repositories/hse-corrective-action.repository';
import { HseIncidentRepository } from './repositories/hse-incident.repository';
import { HseInspectionRepository } from './repositories/hse-inspection.repository';
import { HseService } from './services/hse.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HseIncident,
      HseInspection,
      HseInspectionFinding, // add
      HseCorrectiveAction,
    ]),
    ContractModule,
  ],
  controllers: [HseController],
  providers: [
    HseService,
    HseIncidentRepository,
    HseInspectionRepository,
    HseCorrectiveActionRepository,
  ],
  exports: [HseService],
})
export class HseModule {}
