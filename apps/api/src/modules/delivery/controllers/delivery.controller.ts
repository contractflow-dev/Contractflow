import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CurrentCompanyId } from '../../../common/decorators/current-company-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { ContractContextGuard } from '../../../common/guards/contract-context.guard';
import { CurrentContractId } from '../../../common/decorators/current-contract-id.decorator';
import type { AuthenticatedUser } from '../../identity/interface/auth-context.interface';
import {
  CreateContractStageRequestDto,
  CreateMilestoneRequestDto,
  DecideMilestoneSubmissionRequestDto,
  ListMilestonesRequestDto,
  SubmitMilestoneRequestDto,
  TransitionContractStageRequestDto,
  UpdateContractStageRequestDto,
  UpdateMilestoneRequestDto,
} from '../dto/milestone-workflow-request.dto';
import { DeliveryService } from '../services/delivery.service';
import { MilestoneReadService } from '../services/milestone-read.service';
import { MilestoneWorkflowService } from '../services/milestone-workflow.service';
import { ParseUlidPipe } from '../../../common/pipes/parse-ulid.pipe';

/**
 * Project workspace delivery: stages and milestones (planning, submissions,
 * decisions and outstanding work) and variations. The company and contract
 * come from the headers; the services decide access.
 */
@Controller('contract')
@UseGuards(CompanyContextGuard, ContractContextGuard)
export class DeliveryController {
  constructor(
    private readonly delivery: DeliveryService,
    private readonly milestones: MilestoneReadService,
    private readonly workflow: MilestoneWorkflowService,
  ) {}

  // --- Stages --------------------------------------------------------------

  @Get('stages')
  listStages(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.milestones.listStages(
      { userId: user.id, companyId, contractId },
      query,
    );
  }

  @Post('stages')
  createStage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Body() body: CreateContractStageRequestDto,
  ) {
    return this.workflow.createStage(
      { userId: user.id, companyId, contractId },
      body,
    );
  }

  @Get('stages/:stageId')
  getStage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('stageId', ParseUlidPipe) stageId: string,
  ) {
    return this.milestones.getStage(
      { userId: user.id, companyId, contractId },
      stageId,
    );
  }

  @Patch('stages/:stageId')
  updateStage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('stageId', ParseUlidPipe) stageId: string,
    @Body() body: UpdateContractStageRequestDto,
  ) {
    return this.workflow.updateStage(
      { userId: user.id, companyId, contractId },
      stageId,
      body,
    );
  }

  @Post('stages/:stageId/transitions')
  @HttpCode(HttpStatus.OK)
  transitionStage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('stageId', ParseUlidPipe) stageId: string,
    @Body() body: TransitionContractStageRequestDto,
  ) {
    return this.workflow.transitionStage(
      { userId: user.id, companyId, contractId },
      stageId,
      body,
    );
  }

  /** A milestone is created within its stage, named by the path. */
  @Post('stages/:stageId/milestones')
  createMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('stageId', ParseUlidPipe) stageId: string,
    @Body() body: CreateMilestoneRequestDto,
  ) {
    return this.workflow.createMilestone(
      { userId: user.id, companyId, contractId },
      stageId,
      body,
    );
  }

  // --- Milestones ----------------------------------------------------------

  @Get('milestones')
  listMilestones(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: ListMilestonesRequestDto,
  ) {
    return this.milestones.listMilestones(
      { userId: user.id, companyId, contractId },
      query,
    );
  }

  @Get('milestones/:milestoneId')
  getMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
  ) {
    return this.milestones.getMilestone(
      { userId: user.id, companyId, contractId },
      milestoneId,
    );
  }

  @Patch('milestones/:milestoneId')
  updateMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
    @Body() body: UpdateMilestoneRequestDto,
  ) {
    return this.workflow.updateMilestone(
      { userId: user.id, companyId, contractId },
      milestoneId,
      body,
    );
  }

  @Post('milestones/:milestoneId/start')
  @HttpCode(HttpStatus.OK)
  startMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
  ) {
    return this.workflow.startMilestone(
      { userId: user.id, companyId, contractId },
      milestoneId,
    );
  }

  @Get('milestones/:milestoneId/submissions')
  listSubmissions(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
  ) {
    return this.workflow.listSubmissions(
      { userId: user.id, companyId, contractId },
      milestoneId,
    );
  }

  @Post('milestones/:milestoneId/submissions')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
    @Body() body: SubmitMilestoneRequestDto,
  ) {
    return this.workflow.submit(
      { userId: user.id, companyId, contractId },
      milestoneId,
      body,
    );
  }

  @Get('milestones/:milestoneId/submissions/:submissionId')
  getSubmission(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
    @Param('submissionId', ParseUlidPipe) submissionId: string,
  ) {
    return this.workflow.getSubmission(
      { userId: user.id, companyId, contractId },
      milestoneId,
      submissionId,
    );
  }

  @Post('milestones/:milestoneId/submissions/:submissionId/decision')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
    @Param('submissionId', ParseUlidPipe) submissionId: string,
    @Body() body: DecideMilestoneSubmissionRequestDto,
  ) {
    return this.workflow.decide(
      { userId: user.id, companyId, contractId },
      milestoneId,
      submissionId,
      body,
    );
  }

  @Get('milestones/:milestoneId/decisions')
  listDecisions(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
  ) {
    return this.milestones.listDecisions(
      { userId: user.id, companyId, contractId },
      milestoneId,
    );
  }

  @Get('milestones/:milestoneId/outstanding-items')
  listOutstandingItems(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('milestoneId', ParseUlidPipe) milestoneId: string,
  ) {
    return this.milestones.listOutstandingItems(
      { userId: user.id, companyId, contractId },
      milestoneId,
    );
  }

  // --- Variations ----------------------------------------------------------

  @Get('variations')
  listVariations(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.delivery.variations.list(user.id, companyId, contractId, query);
  }

  @Get('variations/:variationId')
  getVariation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentCompanyId() companyId: string,
    @CurrentContractId() contractId: string,
    @Param('variationId', ParseUlidPipe) variationId: string,
  ) {
    return this.delivery.variations.get(
      user.id,
      companyId,
      contractId,
      variationId,
    );
  }
}
