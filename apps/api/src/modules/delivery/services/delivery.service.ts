import { Injectable } from '@nestjs/common';
import type {
  ContractStage as ContractStageResponse,
  ContractVariation as ContractVariationResponse,
  Milestone as MilestoneResponse,
} from '@contractflow/contracts-schema';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import {
  toContractStageResponse,
  toContractVariationResponse,
  toMilestoneResponse,
} from '../dto/delivery-response.dto';
import type { ContractStage } from '../entities/contract-stage.entity';
import type { ContractVariation } from '../entities/contract-variation.entity';
import type { Milestone } from '../entities/milestone.entity';
import { ContractStageRepository } from '../repositories/contract-stage.repository';
import { ContractVariationRepository } from '../repositories/contract-variation.repository';
import { MilestoneRepository } from '../repositories/milestone.repository';

@Injectable()
export class DeliveryService {
  readonly stages: ContractResourceReader<ContractStage, ContractStageResponse>;
  readonly milestones: ContractResourceReader<Milestone, MilestoneResponse>;
  readonly variations: ContractResourceReader<
    ContractVariation,
    ContractVariationResponse
  >;

  constructor(
    access: ContractAccessService,
    stages: ContractStageRepository,
    milestones: MilestoneRepository,
    variations: ContractVariationRepository,
  ) {
    this.stages = new ContractResourceReader(
      access,
      stages,
      'project',
      'Contract stage',
      toContractStageResponse,
    );
    this.milestones = new ContractResourceReader(
      access,
      milestones,
      'project',
      'Milestone',
      toMilestoneResponse,
    );
    this.variations = new ContractResourceReader(
      access,
      variations,
      'project',
      'Contract variation',
      toContractVariationResponse,
    );
  }
}
