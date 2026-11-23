import {
  EMilestoneDecisionType,
  EMilestoneStatus,
  EStatus,
  type CreateContractStageRequest,
  type CreateMilestoneRequest,
  type DecideMilestoneSubmissionRequest,
  type ListMilestonesFilters,
  type MilestoneEvidenceReference,
  type MilestoneOutstandingItemInput,
  type SubmitMilestoneRequest,
  type TransitionContractStageRequest,
  type UpdateContractStageRequest,
  type UpdateMilestoneRequest,
} from '@contractflow/contracts-schema';
import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DAY_OR_ZONED_INSTANT } from '../../../common/application/instant-range';
import { IsMinorAmount } from '../../../common/dto/minor-amount.validation';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;
const INSTANT_MESSAGE =
  'must be a date (YYYY-MM-DD) or an ISO 8601 time with a time zone';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Trims, and turns an empty string into null. */
const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const booleanQuery = ({ value }: { value: unknown }) =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

export class CreateContractStageRequestDto implements CreateContractStageRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 5000)
  description?: string | null;

  @IsInt()
  @Min(0)
  @Max(10_000)
  weightBps!: number;

  @Matches(DAY, { message: 'plannedStartDate must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  plannedStartDate!: string;

  @Matches(DAY, { message: 'plannedEndDate must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  plannedEndDate!: string;
}

export class UpdateContractStageRequestDto
  extends PartialType(CreateContractStageRequestDto)
  implements UpdateContractStageRequest
{
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(1, 2000)
  dateOverrideReason?: string | null;
}

export class TransitionContractStageRequestDto implements TransitionContractStageRequest {
  @IsIn([EStatus.IN_PROGRESS, EStatus.ON_HOLD, EStatus.COMPLETED])
  status!: EStatus.IN_PROGRESS | EStatus.ON_HOLD | EStatus.COMPLETED;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 2000)
  reason?: string | null;

  @IsOptional()
  @Matches(DAY, { message: 'effectiveDate must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  effectiveDate?: string | null;
}

/** `POST /contract/stages/:stageId/milestones`: the stage comes from the path. */
export class CreateMilestoneRequestDto implements CreateMilestoneRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 5000)
  description?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 5000)
  acceptanceCriteria?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 5000)
  deliverables?: string | null;

  @IsInt()
  @Min(0)
  @Max(10_000)
  weightBps!: number;

  @IsOptional()
  @Matches(DAY, { message: 'plannedStartDate must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  plannedStartDate?: string | null;

  @Matches(DAY, { message: 'dueDate must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  dueDate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  targetQuantity?: number | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(1, 40)
  quantityUnit?: string | null;

  @IsBoolean()
  isPaymentMilestone!: boolean;

  @IsOptional()
  @IsMinorAmount('positive')
  amountMinor?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(1, 2000)
  dateOverrideReason?: string | null;
}

export class UpdateMilestoneRequestDto
  // The stage is fixed once a milestone exists; it isn't a field here.
  extends PartialType(CreateMilestoneRequestDto)
  implements UpdateMilestoneRequest
{
  @IsOptional()
  @Matches(DAY, { message: 'revisedDueDate must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  revisedDueDate?: string | null;
}

export class MilestoneEvidenceReferenceDto implements MilestoneEvidenceReference {
  @Matches(ULID, { message: 'documentId must be a ULID' })
  documentId!: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 255)
  caption?: string | null;
}

export class SubmitMilestoneRequestDto implements SubmitMilestoneRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  notes!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  reportedProgressBps?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MilestoneEvidenceReferenceDto)
  evidence!: MilestoneEvidenceReferenceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(ULID, {
    each: true,
    message: 'each outstanding item id must be a ULID',
  })
  outstandingItemIds?: string[];
}

export class MilestoneOutstandingItemInputDto implements MilestoneOutstandingItemInput {
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  quantity?: number | null;
}

export class DecideMilestoneSubmissionRequestDto implements DecideMilestoneSubmissionRequest {
  @IsEnum(EMilestoneDecisionType)
  decision!: EMilestoneDecisionType;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 2000)
  reason?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  approvedBps?: number | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(0, 5000)
  approvedWork?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  approvedQuantity?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MilestoneOutstandingItemInputDto)
  outstandingItems?: MilestoneOutstandingItemInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(ULID, {
    each: true,
    message: 'each accepted item id must be a ULID',
  })
  acceptedItemIds?: string[];
}

/** Query of `GET /contract/milestones`. */
export class ListMilestonesRequestDto
  extends PaginationQueryDto
  implements ListMilestonesFilters
{
  @IsOptional()
  @Matches(ULID, { message: 'contractStageId must be a ULID' })
  contractStageId?: string;

  @IsOptional()
  @IsEnum(EMilestoneStatus)
  status?: EMilestoneStatus;

  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  pendingReview?: boolean;

  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Matches(DAY, { message: 'dueFrom must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  dueFrom?: string;

  @IsOptional()
  @Matches(DAY, { message: 'dueTo must be a day (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  dueTo?: string;

  @IsOptional()
  @Matches(DAY_OR_ZONED_INSTANT, {
    message: `submittedFrom ${INSTANT_MESSAGE}`,
  })
  @IsDateString({ strict: true })
  submittedFrom?: string;

  @IsOptional()
  @Matches(DAY_OR_ZONED_INSTANT, { message: `submittedTo ${INSTANT_MESSAGE}` })
  @IsDateString({ strict: true })
  submittedTo?: string;
}
