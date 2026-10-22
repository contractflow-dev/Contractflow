import { Injectable } from '@nestjs/common';
import { ContractAccessService } from '../../contract/services/contract-access.service';
import { ContractResourceReader } from '../../contract/services/contract-resource-reader';
import { HseCorrectiveAction } from '../entities/hse-corrective-action.entity';
import { HseIncident } from '../entities/hse-incident.entity';
import { HseInspection } from '../entities/hse-inspection.entity';
import { HseCorrectiveActionRepository } from '../repositories/hse-corrective-action.repository';
import { HseIncidentRepository } from '../repositories/hse-incident.repository';
import { HseInspectionRepository } from '../repositories/hse-inspection.repository';

@Injectable()
export class HseService {
  readonly incidents: ContractResourceReader<HseIncident>;
  readonly inspections: ContractResourceReader<HseInspection>;
  readonly correctiveActions: ContractResourceReader<HseCorrectiveAction>;

  constructor(
    access: ContractAccessService,
    incidents: HseIncidentRepository,
    inspections: HseInspectionRepository,
    correctiveActions: HseCorrectiveActionRepository,
  ) {
    this.incidents = new ContractResourceReader(access, incidents, 'hse', 'HSE incident');
    this.inspections = new ContractResourceReader(access, inspections, 'hse', 'HSE inspection');
    this.correctiveActions = new ContractResourceReader(access, correctiveActions, 'hse', 'Corrective action');
  }
}
