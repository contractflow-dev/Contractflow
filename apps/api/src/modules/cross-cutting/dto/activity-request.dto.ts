import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';
import {
  CONTRACT_ACTIVITY_ACTIONS,
  type ContractActivityAction,
  type ContractActivityFilters,
  type ContractActivityWorkspace,
  ULID_PATTERN,
} from '@contractflow/contracts-schema';
import { ACTIVITY_WORKSPACES } from '../../../common/application/activity-entry';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * A calendar day (`2026-11-10`) or an instant that names its time zone
 * (`2026-11-10T08:30:00Z`, `2026-11-10T08:30:00.000+01:00`). An instant
 * without a zone is refused: the server could only guess which one was meant.
 */
const DAY_OR_ZONED_INSTANT =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;
const DATE_MESSAGE =
  'must be a date (YYYY-MM-DD) or an ISO 8601 time with a time zone';

/** Query of `GET /contract/activity`: page, limit and optional filters. */
export class ListContractActivityRequestDto
  extends PaginationQueryDto
  implements ContractActivityFilters
{
  @IsOptional()
  @Matches(DAY_OR_ZONED_INSTANT, { message: `fromDate ${DATE_MESSAGE}` })
  @IsDateString({ strict: true })
  fromDate?: string;

  @IsOptional()
  @Matches(DAY_OR_ZONED_INSTANT, { message: `toDate ${DATE_MESSAGE}` })
  @IsDateString({ strict: true })
  toDate?: string;

  /** A company membership id (ULID), as `actorUserId` in the entries. */
  @IsOptional()
  @Matches(ULID_PATTERN)
  actorUserId?: string;

  @IsOptional()
  @IsIn([...CONTRACT_ACTIVITY_ACTIONS])
  action?: ContractActivityAction;

  /** A record kind as entries name it, such as `document`. */
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{0,59}$/, {
    message: 'entityType must be a snake_case record type',
  })
  entityType?: string;

  /** A record's id: a ULID, or the UUID of an older entry. */
  @IsOptional()
  @Matches(
    /^(?:[0-7][0-9A-HJKMNP-TV-Z]{25}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    { message: 'entityId must be a ULID or UUID' },
  )
  entityId?: string;

  @IsOptional()
  @IsIn([...ACTIVITY_WORKSPACES])
  workspace?: ContractActivityWorkspace;
}
