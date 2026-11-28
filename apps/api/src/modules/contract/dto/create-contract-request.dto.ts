import type {
  AssignableContractWorkspace,
  CreateContractRequest,
  MinorAmount,
} from '@contractflow/contracts-schema';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  Length,
  Min,
} from 'class-validator';
import {
  EContractType,
  ECurrencyCode,
  EPartyType,
  ULID_PATTERN,
} from '@contractflow/contracts-schema';
import { IsMinorAmount } from '../../../common/dto/minor-amount.validation';

const workspaces = ['project', 'hse', 'finance'] as const;

export class CreateContractRequestDto implements CreateContractRequest {
  @IsString()
  @Length(1, 40)
  referenceNumber!: string;

  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(EContractType)
  contractType!: EContractType;

  /**
   * The creating company's party type. It is always the awarding party: a
   * main contract is created by its client, a subcontract by the main
   * contractor. Optional; any other value is refused.
   */
  @IsOptional()
  @IsEnum(EPartyType)
  partyType?: EPartyType;

  @IsArray()
  @ArrayUnique()
  @IsIn(workspaces, { each: true })
  workspaces!: AssignableContractWorkspace[];

  @IsOptional()
  @Matches(ULID_PATTERN)
  parentContractId?: string | null;

  @IsMinorAmount('non-negative')
  originalValueMinor!: MinorAmount;

  @IsEnum(ECurrencyCode)
  currencyCode!: ECurrencyCode;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  retentionRateBps!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  advancePaymentRateBps?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays!: number;

  @IsOptional()
  @IsMinorAmount('non-negative')
  liquidatedDamagesPerDayMinor?: MinorAmount | null;

  @IsDateString()
  awardDate!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsDateString()
  revisedEndDate?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  defectsLiabilityDays!: number;

  @IsString()
  @Length(1, 64)
  @IsTimeZone()
  timezone!: string;
}
