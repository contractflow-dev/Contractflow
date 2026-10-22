import { Injectable } from '@nestjs/common';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import { ContractStage } from '../entities/contract-stage.entity';
import { ContractVariation } from '../entities/contract-variation.entity';
import { Milestone } from '../entities/milestone.entity';
import { ContractStageRepository } from '../repositories/contract-stage.repository';
import { ContractVariationRepository } from '../repositories/contract-variation.repository';
import { MilestoneRepository } from '../repositories/milestone.repository';

@Injectable()
export class DeliveryService {
  readonly stages: ContractResourceReader<ContractStage>;
  readonly milestones: ContractResourceReader<Milestone>;
  readonly variations: ContractResourceReader<ContractVariation>;

  constructor(
    access: ContractAccessService,
    stages: ContractStageRepository,
    milestones: MilestoneRepository,
    variations: ContractVariationRepository,
  ) {
    this.stages = new ContractResourceReader(access, stages, 'project', 'Contract stage');
    this.milestones = new ContractResourceReader(access, milestones, 'project', 'Milestone');
    this.variations = new ContractResourceReader(access, variations, 'project', 'Contract variation');
  }
}
