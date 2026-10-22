import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../identity/services/auth.service';
import {
  ListContractStatusHistoryRequestDto,
  ListContractsRequestDto,
} from '../dto/list-contracts-request.dto';
import { ContractService } from '../services/contract.service';

@Controller('companies/:companyId/contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Query() query: ListContractsRequestDto,
  ) {
    return this.contractService.list(user.id, companyId, query);
  }

  @Get(':contractId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.contractService.get(user.id, companyId, contractId);
  }

  @Get(':contractId/parties')
  listParties(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.contractService.listParties(user.id, companyId, contractId);
  }

  @Get(':contractId/status-history')
  listStatusHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Query() query: ListContractStatusHistoryRequestDto,
  ) {
    return this.contractService.listStatusHistory(
      user.id,
      companyId,
      contractId,
      query,
    );
  }
}
