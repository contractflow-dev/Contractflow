import { Injectable } from '@nestjs/common';
import type {
  HseCorrectiveAction as HseCorrectiveActionResponse,
  HseIncident as HseIncidentResponse,
  HseInspection as HseInspectionResponse,
} from '@contractflow/contracts-schema';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import {
  toHseCorrectiveActionResponse,
  toHseIncidentResponse,
  toHseInspectionResponse,
} from '../dto/hse-response.dto';
import type { HseCorrectiveAction } from '../entities/hse-corrective-action.entity';
import type { HseIncident } from '../entities/hse-incident.entity';
import type { HseInspection } from '../entities/hse-inspection.entity';
import { HseCorrectiveActionRepository } from '../repositories/hse-corrective-action.repository';
import { HseIncidentRepository } from '../repositories/hse-incident.repository';
import { HseInspectionRepository } from '../repositories/hse-inspection.repository';

@Injectable()
export class HseService {
  readonly incidents: ContractResourceReader<HseIncident, HseIncidentResponse>;
  readonly inspections: ContractResourceReader<
    HseInspection,
    HseInspectionResponse
  >;
  readonly correctiveActions: ContractResourceReader<
    HseCorrectiveAction,
    HseCorrectiveActionResponse
  >;

  constructor(
    access: ContractAccessService,
    incidents: HseIncidentRepository,
    inspections: HseInspectionRepository,
    correctiveActions: HseCorrectiveActionRepository,
  ) {
    this.incidents = new ContractResourceReader(
      access,
      incidents,
      'hse',
      'HSE incident',
      toHseIncidentResponse,
    );
    this.inspections = new ContractResourceReader(
      access,
      inspections,
      'hse',
      'HSE inspection',
      toHseInspectionResponse,
    );
    this.correctiveActions = new ContractResourceReader(
      access,
      correctiveActions,
      'hse',
      'Corrective action',
      toHseCorrectiveActionResponse,
    );
  }
}
