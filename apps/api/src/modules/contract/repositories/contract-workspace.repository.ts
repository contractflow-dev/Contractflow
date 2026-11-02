import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { IContractCompanyScope } from '../../../common/database/repositories/contract-scope.interface';
import { ContractParty } from '../entities/contract-party.entity';
import { ContractWorkspaceEntity } from '../entities/contract-workspace.entity';
import type { AssignableContractWorkspace } from '../services/contract-workspace';

@Injectable()
export class ContractWorkspaceRepository {
  constructor(
    @InjectRepository(ContractWorkspaceEntity)
    private readonly workspaces: Repository<ContractWorkspaceEntity>,
    @InjectRepository(ContractParty)
    private readonly parties: Repository<ContractParty>,
  ) {}

  async exists(
    scope: IContractCompanyScope,
    workspace: AssignableContractWorkspace,
  ): Promise<boolean> {
    const contractId = scope?.contractId?.trim();
    const companyId = scope?.companyId?.trim();
    if (!contractId || !companyId) {
      throw new BadRequestException(
        'Company and contract context are required',
      );
    }

    const isParty = await this.parties.exists({
      where: { contractId, companyId },
    });
    if (!isParty) {
      throw new NotFoundException('Contract was not found');
    }

    return this.workspaces.exists({ where: { contractId, workspace } });
  }

  async findWorkspaces(
    scope: IContractCompanyScope,
  ): Promise<AssignableContractWorkspace[]> {
    const contractId = scope?.contractId?.trim();
    const companyId = scope?.companyId?.trim();
    if (!contractId || !companyId) {
      throw new BadRequestException(
        'Company and contract context are required',
      );
    }

    const isParty = await this.parties.exists({
      where: { contractId, companyId },
    });
    if (!isParty) {
      throw new NotFoundException('Contract was not found');
    }

    const rows = await this.workspaces.find({
      where: { contractId },
      order: { workspace: 'ASC' },
      select: { workspace: true },
    });
    return rows.map(({ workspace }) => workspace);
  }
}
