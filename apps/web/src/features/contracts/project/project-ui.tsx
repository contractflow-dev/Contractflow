"use client";

import type { ReactNode } from "react";
import { RiAlarmWarningLine, RiHistoryLine } from "@remixicon/react";
import type { Contract, Milestone } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@workspace/ui/components/progress";
import { Sheet, SheetContent } from "@workspace/ui/components/sheet";
import { StatusBadge } from "@/components/status-badge/status-badge";
import {
  EMPTY_VALUE,
  formatBasisPoints,
  formatCalendarDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectPermissions } from "./project-rules";
import { legacyStatusLabel } from "./project-rules";

/**
 * What every Project workspace screen needs: the contract (its status and
 * time zone), the viewer's permissions, and the viewer's company membership,
 * which the API's `submittedById` and `decidedById` name.
 */
export interface ProjectContext {
  companyId: string;
  contractId: string;
  contract: Contract;
  permissions: ProjectPermissions;
  viewerMembershipId?: string;
}

/** A share in basis points as a labelled bar (10,000 = 100%). */
export function BpsMeter({
  value,
  label,
  className,
  hideLabel = false,
}: {
  value: number;
  /** Names the bar, such as "Approved". */
  label: string;
  className?: string;
  /** Keep the label for screen readers only (for table cells). */
  hideLabel?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, value / 100));
  return (
    <Progress
      value={percent}
      className={cn("min-w-24 gap-1.5", className)}
      // The bar's own value text: "45%" rather than "45".
      getAriaValueText={() => formatBasisPoints(value)}
    >
      <ProgressLabel
        className={cn(
          "text-xs font-normal text-muted-foreground",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </ProgressLabel>
      <ProgressValue className="text-xs">
        {() => formatBasisPoints(value)}
      </ProgressValue>
    </Progress>
  );
}

/** Two calendar days, "1 Jan 2027 – 31 Mar 2027", or a dash when neither is set. */
export function DayRange({
  from,
  to,
}: {
  from: string | null | undefined;
  to: string | null | undefined;
}) {
  if (!from && !to) return <>{EMPTY_VALUE}</>;
  return (
    <span className="whitespace-nowrap">
      {formatCalendarDate(from)} – {formatCalendarDate(to)}
    </span>
  );
}

/**
 * A milestone's status, the API's overdue verdict (judged in the contract's
 * time zone, never recomputed here) and any legacy status as context.
 */
export function MilestoneStatus({
  milestone,
  className,
}: {
  milestone: Pick<Milestone, "status" | "isOverdue" | "legacyStatus">;
  className?: string;
}) {
  const legacy = legacyStatusLabel(milestone.legacyStatus);
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <StatusBadge status={milestone.status} />
      {milestone.isOverdue ? <OverdueBadge /> : null}
      {legacy ? (
        <Badge
          variant="outline"
          className="gap-1 font-normal text-muted-foreground"
          title="The status this milestone had before it moved into the approval workflow"
        >
          <RiHistoryLine aria-hidden="true" className="size-3" />
          {legacy}
        </Badge>
      ) : null}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <Badge variant="destructive" className="gap-1">
      <RiAlarmWarningLine aria-hidden="true" className="size-3" />
      Overdue
    </Badge>
  );
}

/** Why the contract's status limits changes, shown above the content. */
export function ProjectStatusNotice({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <Alert>
      <AlertDescription>{notice}</AlertDescription>
    </Alert>
  );
}

/** A form in a sheet from the right, as the other contract forms are. */
export function FormSheet({
  open,
  busy,
  onClose,
  children,
}: {
  open: boolean;
  /** While saving or uploading, the sheet can't be dismissed. */
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      disablePointerDismissal
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={!busy}
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
      >
        {open ? children : null}
      </SheetContent>
    </Sheet>
  );
}

/** A labelled value in a definition list. */
export function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

/** Long text as the user wrote it, keeping their line breaks. */
export function Prose({ text }: { text: string | null | undefined }) {
  if (!text) return <span className="text-muted-foreground">Not given</span>;
  return <span className="whitespace-pre-line">{text}</span>;
}
