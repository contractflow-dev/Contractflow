"use client";

import Link from "next/link";
import {
  RiArrowRightLine,
  RiBuilding2Line,
  RiFileList3Line,
  RiFileTextLine,
  RiHistoryLine,
  RiMapPinLine,
  RiQuillPenLine,
  RiUserSettingsLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { useEffect, useId, useState } from "react";
import {
  CONTRACT_ACTIVITY_ACTIONS,
  type ContractActivityAction,
  type ContractActivityActor,
  type ContractActivityFilters,
} from "@contractflow/contracts-schema";
import { DataPagination } from "@/components/pagination/data-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import {
  dayBoundsInTimeZone,
  formatCalendarDate,
  formatDateTime,
  humanizeEnumValue,
} from "@/lib/format";
import {
  useGetContractActivityActorsQuery,
  useGetContractActivityQuery,
  type ContractActivityItem,
} from "@/services/contractApi";
import {
  CONTRACT_SECTIONS,
  contractSectionHref,
  isRestrictedContractSection,
  type ContractSection,
  type RestrictedContractSection,
} from "../contract-sections";

/**
 * Status changes are written to both the status history and the activity
 * log. The status history is the complete record (it covers every party), so
 * the timeline leaves these entries out instead of listing them twice.
 */
export const STATUS_CHANGE_ACTION = "contract.status_transitioned";

type ActivityCategory =
  "contract" | "documents" | "roles" | "parties" | "sites" | "signatories";

const CATEGORY: Record<
  ActivityCategory,
  { label: string; icon: RemixiconComponentType }
> = {
  contract: { label: "Contract", icon: RiFileList3Line },
  documents: { label: "Documents", icon: RiFileTextLine },
  roles: { label: "Roles", icon: RiUserSettingsLine },
  parties: { label: "Parties", icon: RiBuilding2Line },
  sites: { label: "Sites", icon: RiMapPinLine },
  signatories: { label: "Signatories", icon: RiQuillPenLine },
};

/** Readable names for the actions the API currently records. */
const ACTION_LABEL: Record<string, string> = {
  "contract.updated": "Contract details updated",
  "contract.workspaces_removed": "Workspaces removed",
  "contract.deleted": "Contract archived",
  "contract.restored": "Contract restored",
  "contract.site_created": "Site added",
  "contract.site_updated": "Site updated",
  "contract.signatory_recorded": "Signatory recorded",
  "contract.party_invitation_created": "Company invited",
  "contract.party_invitation_revoked": "Company invitation revoked",
  "contract.party_invitation_accepted": "Contract invitation accepted",
  "contract.party_invitation_rejected": "Contract invitation declined",
  "contract.role_assigned": "Contract role assigned",
  "contract.role_revoked": "Contract role revoked",
  "contract.role_invitation_created": "Role invitation sent",
  "contract.role_invitation_revoked": "Role invitation revoked",
  "contract.workspace_admin_granted": "Workspace Admin rights granted",
  "contract.workspace_admin_revoked": "Workspace Admin rights revoked",
  "document.upload_initiated": "Document upload started",
  "document.upload_completed": "Document uploaded",
  "document.upload_failed": "Document upload failed",
  "document.version_added": "New document version",
  "document.downloaded": "Document downloaded",
  "document.deleted": "Document deleted",
};

/** The category an action belongs to, from its name. */
export function activityCategory(action: string): ActivityCategory {
  if (action.startsWith("document.")) return "documents";
  if (/role|workspace_admin/.test(action)) return "roles";
  if (action.includes("party_invitation")) return "parties";
  if (action.includes("site_")) return "sites";
  if (action.includes("signatory")) return "signatories";
  return "contract";
}

/**
 * The label for an action. An action added to the API later still reads as
 * words (`contract.milestone_added` becomes "Milestone added"), never as the
 * raw identifier.
 */
export function activityLabel(action: string): string {
  return (
    ACTION_LABEL[action] ??
    humanizeEnumValue(action.slice(action.indexOf(".") + 1))
  );
}

/**
 * Who acted: "You" for the viewer's own membership, otherwise the name the
 * API resolved within the viewer's company. Without one (the API returns
 * null), it falls back to the company rather than inventing a name.
 */
export function activityActor(
  entry: Pick<ContractActivityItem, "actorUserId" | "actorName">,
  viewer?: { membershipId: string; companyName: string },
): string {
  if (viewer && entry.actorUserId === viewer.membershipId) return "You";
  const name = entry.actorName?.trim();
  if (name) return name;
  return viewer?.companyName
    ? `A member of ${viewer.companyName}`
    : "A member of your company";
}

/**
 * Where each action's records are listed in this contract. The link always
 * stays in the contract that is open: it is built from the action and the
 * current contract, never from an entry's `entityId` (a generated id, not the
 * record's). Each section loads its records through its own guarded API.
 *
 * Left out on purpose: contract-level actions (archived, restored, workspaces
 * removed, status changed), whose record is the contract already open, and
 * `document.deleted`, whose document no longer exists.
 */
const ACTION_SECTION: Partial<Record<ContractActivityAction, ContractSection>> =
  {
    "contract.site_created": "sites",
    "contract.site_updated": "sites",
    "contract.signatory_recorded": "signatories",
    "contract.party_invitation_created": "parties",
    "contract.party_invitation_revoked": "parties",
    "contract.party_invitation_accepted": "parties",
    "contract.party_invitation_rejected": "parties",
    "contract.role_assigned": "roles",
    "contract.role_revoked": "roles",
    "contract.role_invitation_created": "roles",
    "contract.role_invitation_revoked": "roles",
    "contract.workspace_admin_granted": "roles",
    "contract.workspace_admin_revoked": "roles",
    "document.upload_initiated": "documents",
    "document.upload_completed": "documents",
    "document.upload_failed": "documents",
    "document.version_added": "documents",
    "document.downloaded": "documents",
  };

/** Whether the viewer can use each restricted section; undefined = unknown. */
export type ActivitySectionAccess = Partial<
  Record<RestrictedContractSection, boolean | undefined>
>;

/**
 * The section an entry links to, or null. A restricted section (roles, sites,
 * signatories) is offered only when the viewer can use it, like its tab; the
 * API decides access either way.
 */
export function activityDestination(
  action: string,
  access: ActivitySectionAccess = {},
): ContractSection | null {
  const section = isActivityAction(action) ? ACTION_SECTION[action] : undefined;
  if (!section) return null;
  if (isRestrictedContractSection(section) && access[section] !== true) {
    return null;
  }
  return section;
}

function sectionLabel(section: ContractSection): string {
  return CONTRACT_SECTIONS.find(({ id }) => id === section)?.label ?? section;
}

/** The timeline's filters and page, kept while the user visits other tabs. */
export interface SavedActivityView {
  values: ActivityFilterValues;
  page: number;
  limit: number;
}

const ACTIVITY_VIEW_KEY = "contractflow:contract-activity";

export function activityViewKey(companyId: string, contractId: string) {
  return `${ACTIVITY_VIEW_KEY}:${companyId}:${contractId}`;
}

/**
 * The view saved for this company and contract in this browser tab, or null.
 * It is a convenience only: anything malformed is ignored, and every value
 * goes through the same API validation and authorization as a fresh choice.
 */
export function readActivityView(key: string): SavedActivityView | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    const { values, page, limit } = saved as Record<string, unknown>;
    const v = (values ?? {}) as Record<string, unknown>;
    const day = (value: unknown) =>
      typeof value === "string" && /^(\d{4}-\d{2}-\d{2})?$/.test(value);
    if (
      !day(v.fromDay) ||
      !day(v.toDay) ||
      typeof v.actorUserId !== "string" ||
      !/^([0-7][0-9A-HJKMNP-TV-Z]{25})?$/i.test(v.actorUserId) ||
      typeof v.action !== "string" ||
      (v.action !== "" && !isActivityAction(v.action)) ||
      !Number.isInteger(page) ||
      (page as number) < 1 ||
      !PAGE_SIZE_OPTIONS.includes(limit as number)
    ) {
      return null;
    }
    return {
      values: {
        fromDay: v.fromDay as string,
        toDay: v.toDay as string,
        actorUserId: v.actorUserId,
        action: v.action as ContractActivityAction | "",
      },
      page: page as number,
      limit: limit as number,
    };
  } catch {
    return null;
  }
}

function writeActivityView(key: string, view: SavedActivityView) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(view));
  } catch {
    // Storage can be unavailable (private mode, quotas); the view still works.
  }
}

/** What the filter controls hold: calendar days, a membership id, an action. */
export interface ActivityFilterValues {
  fromDay: string;
  toDay: string;
  actorUserId: string;
  action: ContractActivityAction | "";
}

export const NO_ACTIVITY_FILTERS: ActivityFilterValues = {
  fromDay: "",
  toDay: "",
  actorUserId: "",
  action: "",
};

/**
 * The API filters for the controls' values. Days become the first and last
 * instant of that day in the viewer's time zone. An end day before the start
 * day is reported instead of sent, so the API never sees a range it refuses.
 */
export function toActivityQueryFilters(
  values: ActivityFilterValues,
  timeZone: string | undefined,
): { filters: ContractActivityFilters; rangeError: string | null } {
  const from = values.fromDay
    ? dayBoundsInTimeZone(values.fromDay, timeZone)
    : null;
  const to = values.toDay ? dayBoundsInTimeZone(values.toDay, timeZone) : null;
  const rangeError =
    from && to && from.start > to.end
      ? "The end date is before the start date."
      : null;
  return {
    filters: {
      fromDate: rangeError ? undefined : from?.start,
      toDate: rangeError ? undefined : to?.end,
      actorUserId: values.actorUserId || undefined,
      action: values.action || undefined,
    },
    rangeError,
  };
}

/** The action filter's choices, grouped by category. Status changes are left
 *  to the status history, as in the timeline itself. */
export const ACTION_FILTER_GROUPS = (
  Object.keys(CATEGORY) as ActivityCategory[]
)
  .map((category) => ({
    category,
    label: CATEGORY[category].label,
    actions: CONTRACT_ACTIVITY_ACTIONS.filter(
      (action) =>
        action !== STATUS_CHANGE_ACTION &&
        activityCategory(action) === category,
    ),
  }))
  .filter((group) => group.actions.length > 0);

function isActivityAction(value: string): value is ContractActivityAction {
  return (CONTRACT_ACTIVITY_ACTIONS as readonly string[]).includes(value);
}

/** The actor filter's option text: the name, "(you)" for the viewer. */
export function actorOptionLabel(
  actor: ContractActivityActor,
  viewerMembershipId?: string,
): string {
  const name = actor.actorName?.trim() || "Unnamed member";
  return actor.actorUserId === viewerMembershipId ? `${name} (you)` : name;
}

/** A sentence naming the active filters, for sighted and screen-reader users. */
export function describeActivityFilters(
  values: ActivityFilterValues,
  actors: readonly ContractActivityActor[],
  viewerMembershipId?: string,
): string | null {
  const parts: string[] = [];
  if (values.fromDay && values.toDay) {
    parts.push(
      `${formatCalendarDate(values.fromDay)} to ${formatCalendarDate(values.toDay)}`,
    );
  } else if (values.fromDay) {
    parts.push(`from ${formatCalendarDate(values.fromDay)}`);
  } else if (values.toDay) {
    parts.push(`up to ${formatCalendarDate(values.toDay)}`);
  }
  if (values.actorUserId) {
    const actor = actors.find(
      (candidate) => candidate.actorUserId === values.actorUserId,
    );
    parts.push(
      actor ? actorOptionLabel(actor, viewerMembershipId) : "one member",
    );
  }
  if (values.action) parts.push(activityLabel(values.action));
  return parts.length ? `Filtered: ${parts.join(" · ")}` : null;
}

/**
 * The contract's activity timeline: what members of the viewer's company did
 * on it, newest first. Shown beside the status history, which stays the
 * record of status changes. The API requires an active contract role and
 * scopes the entries to the caller's company; this component only presents
 * what it returns.
 */
export function ContractActivity({
  companyId,
  contractId,
  viewer,
  sectionAccess,
}: {
  companyId: string;
  contractId: string;
  /** The signed-in member, to show their own entries as "You". */
  viewer?: { membershipId: string; companyName: string };
  /** Which restricted sections the viewer can open, as for their tabs. */
  sectionAccess?: ActivitySectionAccess;
}) {
  const timeZone = useUserTimeZone();
  // Restores this contract's filters and page after visiting another tab.
  const viewKey = activityViewKey(companyId, contractId);
  const [saved] = useState(() => readActivityView(viewKey));
  const pagination = usePagination(saved?.limit ?? 10, saved?.page);
  const [values, setValues] = useState<ActivityFilterValues>(
    saved?.values ?? NO_ACTIVITY_FILTERS,
  );
  useEffect(() => {
    writeActivityView(viewKey, {
      values,
      page: pagination.page,
      limit: pagination.limit,
    });
  }, [viewKey, values, pagination.page, pagination.limit]);
  // Dates apply once they stop changing, so typing a year doesn't send a
  // request per keystroke; selects apply at once.
  // Both dates share one pause, so setting a range sends one request.
  // Clearing a date applies at once, so "Clear filters" never sends an old one.
  const [debouncedFromDay, debouncedToDay] = useDebouncedValue(
    `${values.fromDay}|${values.toDay}`,
    400,
  ).split("|");
  const fromDay = values.fromDay ? debouncedFromDay : "";
  const toDay = values.toDay ? debouncedToDay : "";
  const { filters, rangeError } = toActivityQueryFilters(
    { ...values, fromDay, toDay },
    timeZone,
  );
  const activity = useGetContractActivityQuery(
    {
      companyId,
      contractId,
      page: pagination.page,
      limit: pagination.limit,
      ...filters,
    },
    // An audit trail should be current whenever it is opened.
    { refetchOnMountOrArgChange: true },
  );
  // currentData belongs to exactly these arguments, so a slower response for
  // earlier filters never replaces the results of newer ones.
  const data = activity.currentData;
  useKeepPageInRange(data?.meta, pagination.setPage);

  const loading = activity.isLoading || (activity.isFetching && !data);
  const noAccess = getApiErrorStatus(activity.error) === 403;
  // The member list is fetched once the activity has loaded, never for
  // someone the API refuses. `data` keeps the last result while new filters
  // load, so the list stays put between filter changes.
  const actors =
    useGetContractActivityActorsQuery(
      { companyId, contractId },
      { skip: !activity.data },
    ).currentData ?? [];

  const update = (patch: Partial<ActivityFilterValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    pagination.resetPage();
  };
  const clearFilters = () => {
    setValues(NO_ACTIVITY_FILTERS);
    pagination.resetPage();
  };
  const filtered = Object.values(values).some(Boolean);
  const summary = describeActivityFilters(values, actors, viewer?.membershipId);
  const ids = {
    from: useId(),
    to: useId(),
    actor: useId(),
    action: useId(),
  };
  const entries = (data?.data ?? []).filter(
    (entry) => entry.action !== STATUS_CHANGE_ACTION,
  );
  const hiddenStatusChanges = (data?.data.length ?? 0) - entries.length;
  const companyLabel = viewer?.companyName ?? "your company";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Activity</h2>
        </CardTitle>
        <CardDescription>
          What members of {companyLabel} have done on this contract, newest
          first. Other companies&apos; actions aren&apos;t shown here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {noAccess ? null : (
          <div className="space-y-3">
            <div
              role="group"
              aria-label="Filter activity"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Field>
                <FieldLabel htmlFor={ids.from}>From</FieldLabel>
                <Input
                  id={ids.from}
                  type="date"
                  value={values.fromDay}
                  max={values.toDay || undefined}
                  onChange={(event) => update({ fromDay: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.to}>To</FieldLabel>
                <Input
                  id={ids.to}
                  type="date"
                  value={values.toDay}
                  min={values.fromDay || undefined}
                  aria-invalid={rangeError ? true : undefined}
                  aria-describedby={rangeError ? `${ids.to}-error` : undefined}
                  onChange={(event) => update({ toDay: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.actor}>Member</FieldLabel>
                <NativeSelect
                  id={ids.actor}
                  className="w-full"
                  value={values.actorUserId}
                  onChange={(event) =>
                    update({ actorUserId: event.target.value })
                  }
                >
                  <NativeSelectOption value="">All members</NativeSelectOption>
                  {actors.map((actor) => (
                    <NativeSelectOption
                      key={actor.actorUserId}
                      value={actor.actorUserId}
                    >
                      {actorOptionLabel(actor, viewer?.membershipId)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={ids.action}>Action</FieldLabel>
                <NativeSelect
                  id={ids.action}
                  className="w-full"
                  value={values.action}
                  onChange={(event) => {
                    const action = event.target.value;
                    update({ action: isActivityAction(action) ? action : "" });
                  }}
                >
                  <NativeSelectOption value="">All actions</NativeSelectOption>
                  {ACTION_FILTER_GROUPS.map((group) => (
                    <NativeSelectOptGroup
                      key={group.category}
                      label={group.label}
                    >
                      {group.actions.map((action) => (
                        <NativeSelectOption key={action} value={action}>
                          {activityLabel(action)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {rangeError ? (
              <p
                id={`${ids.to}-error`}
                role="alert"
                className="text-sm text-destructive-soft-foreground"
              >
                {rangeError}
              </p>
            ) : null}
            {filtered ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p
                  aria-live="polite"
                  className="min-w-0 text-sm break-words text-muted-foreground"
                >
                  {summary}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        )}
        {activity.error && !data ? (
          noAccess ? (
            <div className="space-y-1 py-2">
              <p className="text-sm font-medium">
                Activity is shared with the contract team
              </p>
              <p className="text-sm text-muted-foreground">
                Only people who hold a role on this contract can see its
                activity. A Company Administrator can assign contract roles from
                the Roles section. The status history above stays available.
              </p>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {getApiErrorMessage(
                    activity.error,
                    "Unable to load contract activity.",
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void activity.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )
        ) : loading ? (
          <div role="status" aria-label="Loading contract activity">
            <ul className="space-y-5" aria-hidden="true">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex items-start gap-3">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <div className="w-full space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : data && data.meta.totalItems > 0 ? (
          <div className="space-y-5">
            {entries.length ? (
              <ol aria-label="Contract activity" className="space-y-0">
                {entries.map((entry, index) => (
                  <ActivityEntry
                    key={entry.id}
                    entry={entry}
                    last={index === entries.length - 1}
                    actor={activityActor(entry, viewer)}
                    timeZone={timeZone}
                    contractId={contractId}
                    destination={activityDestination(
                      entry.action,
                      sectionAccess,
                    )}
                    target={entry.target}
                  />
                ))}
              </ol>
            ) : null}
            {hiddenStatusChanges > 0 ? (
              <p className="text-xs text-muted-foreground">
                {hiddenStatusChanges === 1
                  ? "1 status change on this page is"
                  : `${hiddenStatusChanges} status changes on this page are`}{" "}
                listed in the status history above.
              </p>
            ) : null}
            <DataPagination
              meta={data.meta}
              itemLabel="activity records"
              isFetching={activity.isFetching}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setLimit}
            />
          </div>
        ) : filtered ? (
          <Empty className="p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-full">
                <RiHistoryLine aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-sm">
                No activity matches these filters
              </EmptyTitle>
              <EmptyDescription className="text-xs">
                Try a wider date range, another member or another action.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          </Empty>
        ) : (
          <Empty className="p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-full">
                <RiHistoryLine aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No activity yet</EmptyTitle>
              <EmptyDescription className="text-xs">
                Changes your company makes to this contract, such as roles,
                sites, invitations and documents, will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityEntry({
  entry,
  last,
  actor,
  timeZone,
  contractId,
  destination,
  target,
}: {
  entry: ContractActivityItem;
  last: boolean;
  actor: string;
  timeZone: string | undefined;
  contractId: string;
  /** The section listing this entry's record, or null for no link. */
  destination: ContractSection | null;
  target: ContractActivityItem["target"];
}) {
  const category = CATEGORY[activityCategory(entry.action)];
  const Icon = category.icon;
  const label = activityLabel(entry.action);
  return (
    <li className="relative flex min-w-0 gap-3 pb-5 last:pb-0">
      {/* The line joining this entry's marker to the next one. */}
      {last ? null : (
        <span
          aria-hidden="true"
          className="absolute start-3.5 top-8 bottom-0 w-px -translate-x-1/2 bg-border rtl:translate-x-1/2"
        />
      )}
      <span
        aria-hidden="true"
        className="relative grid size-7 shrink-0 place-items-center rounded-full border bg-muted text-muted-foreground"
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium break-words">{label}</p>
          <Badge variant="outline" className="font-normal">
            {category.label}
          </Badge>
        </div>
        {entry.summary ? (
          <p className="text-sm break-words text-muted-foreground">
            {entry.summary}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          <span>{actor}</span>
          <span aria-hidden="true"> · </span>
          <time dateTime={entry.occurredAt}>
            {formatDateTime(entry.occurredAt, { timeZone })}
          </time>
        </p>
        {destination ? (
          <Link
            href={contractSectionHref(contractId, destination, target)}
            // The name starts with the visible text, then says which entry.
            aria-label={`Open ${sectionLabel(destination)}: ${label}`}
            className="inline-flex items-center gap-1 rounded-sm text-sm text-primary underline-offset-4 hover:underline"
          >
            Open {sectionLabel(destination)}
            <RiArrowRightLine className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}
