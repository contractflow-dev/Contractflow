import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractModule } from '../contract/contract-module';
import { DeliveryController } from './controllers/delivery.controller';
import { ContractStage } from './entities/contract-stage.entity';
import { ContractVariation } from './entities/contract-variation.entity';
import { Milestone } from './entities/milestone.entity';
import { ContractStageRepository } from './repositories/contract-stage.repository';
import { ContractVariationRepository } from './repositories/contract-variation.repository';
import { MilestoneRepository } from './repositories/milestone.repository';
import { DeliveryService } from './services/delivery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractStage, Milestone, ContractVariation]),
    ContractModule,
  ],
  controllers: [DeliveryController],
  providers: [
    DeliveryService,
    ContractStageRepository,
    MilestoneRepository,
    ContractVariationRepository,
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
