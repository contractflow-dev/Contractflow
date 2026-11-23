import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TypeOrmUnitOfWork } from '../../common/database/typeorm-unit-of-work';
import { ContractModule } from '../contract/contract-module';
import { IdentityModule } from '../identity/identity.module';
import { DeliveryController } from './controllers/delivery.controller';
import { ContractStage } from './entities/contract-stage.entity';
import { ContractVariation } from './entities/contract-variation.entity';
import { MilestoneDecision } from './entities/milestone-decision.entity';
import { MilestoneOutstandingItem } from './entities/milestone-outstanding-item.entity';
import { MilestoneSubmissionEvidence } from './entities/milestone-submission-evidence.entity';
import { MilestoneSubmissionItem } from './entities/milestone-submission-item.entity';
import { MilestoneSubmission } from './entities/milestone-submission.entity';
import { Milestone } from './entities/milestone.entity';
import {
  MILESTONE_WORKFLOW_READER,
  MILESTONE_WORKFLOW_UNIT_OF_WORK,
  type IMilestoneWorkflowContext,
} from './interface/milestone-workflow-persistence.interface';
import { ContractStageRepository } from './repositories/contract-stage.repository';
import { ContractVariationRepository } from './repositories/contract-variation.repository';
import { MilestoneRepository } from './repositories/milestone.repository';
import {
  MilestoneDecisionRepository,
  MilestoneOutstandingItemRepository,
  MilestoneSubmissionEvidenceRepository,
  MilestoneSubmissionItemRepository,
  MilestoneSubmissionRepository,
} from './repositories/milestone-history.repositories';
import {
  MilestoneWorkflowContextFactory,
  TypeOrmMilestoneWorkflowReader,
} from './repositories/milestone-workflow-context.factory';
import { DeliveryService } from './services/delivery.service';
import { MilestoneReadService } from './services/milestone-read.service';
import { MilestoneWorkflowService } from './services/milestone-workflow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContractStage,
      Milestone,
      ContractVariation,
      MilestoneSubmission,
      MilestoneSubmissionEvidence,
      MilestoneDecision,
      MilestoneOutstandingItem,
      MilestoneSubmissionItem,
    ]),
    ContractModule,
    IdentityModule,
  ],
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    MilestoneReadService,
    MilestoneWorkflowService,
    ContractStageRepository,
    MilestoneRepository,
    ContractVariationRepository,
    MilestoneSubmissionRepository,
    MilestoneSubmissionEvidenceRepository,
    MilestoneDecisionRepository,
    MilestoneOutstandingItemRepository,
    MilestoneSubmissionItemRepository,
    {
      provide: MILESTONE_WORKFLOW_UNIT_OF_WORK,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUnitOfWork<IMilestoneWorkflowContext>(
          dataSource,
          new MilestoneWorkflowContextFactory(),
        ),
      inject: [DataSource],
    },
    {
      provide: MILESTONE_WORKFLOW_READER,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmMilestoneWorkflowReader(dataSource.manager),
      inject: [DataSource],
    },
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
