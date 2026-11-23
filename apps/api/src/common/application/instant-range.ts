import { BadRequestException } from '@nestjs/common';

/**
 * A calendar day (`2026-11-10`) or an ISO 8601 instant that names its time
 * zone (`2026-11-10T08:30:00Z`, `…+01:00`). An instant without a zone is
 * refused: the server could only guess which one was meant. The activity log
 * filters accept the same forms.
 */
export const DAY_OR_ZONED_INSTANT =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Turns a validated `from`/`to` pair into inclusive instants. A calendar day
 * runs from its first UTC millisecond to its last; an instant is used as is.
 * A range that ends before it starts is refused.
 */
export function toInstantRange(
  from: string | undefined,
  to: string | undefined,
  what: string,
): { from?: Date; to?: Date } {
  const start = from ? instant(from, 'start', what) : undefined;
  const end = to ? instant(to, 'end', what) : undefined;
  if (start && end && start.getTime() > end.getTime()) {
    throw new BadRequestException(
      `The ${what} start must not be after its end.`,
    );
  }
  return { from: start, to: end };
}

function instant(value: string, edge: 'start' | 'end', what: string): Date {
  const isDay = CALENDAR_DAY.test(value);
  const date = new Date(isDay ? `${value}T00:00:00.000Z` : value);
  if (!DAY_OR_ZONED_INSTANT.test(value) || Number.isNaN(date.getTime())) {
    throw new BadRequestException(`The ${what} is not a valid date.`);
  }
  return isDay && edge === 'end' ? new Date(date.getTime() + DAY_MS - 1) : date;
}
