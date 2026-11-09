import {
  ECompanyStatus,
  ECompanyUserStatus,
  EContractSiteStatus,
  EContractStatus,
  EDocumentUploadStatus,
  EFromStatus,
  EInvitationStatus,
  EToStatus,
} from "@contractflow/contracts-schema";
import type { ContractPartyInvitation } from "@contractflow/contracts-schema";
import { Badge } from "@workspace/ui/components/badge";
import { humanizeEnumValue } from "@/lib/format";

/**
 * Visual tone of a status. Tones group statuses by meaning; the label always
 * names the status, so colour is never the only signal.
 */
export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "inactive";

/** Contract-party and contract-role invitations add a "rejected" state. */
type ContractInvitationStatus = ContractPartyInvitation["status"];

/** A record shown as archived (soft-deleted) rather than by its status. */
export const ARCHIVED_STATUS = "archived";

/**
 * Every status value the web app currently displays. Several enums share a
 * value (contracts, sites, and members can all be "active"); a shared value
 * has one meaning everywhere, so one entry covers them all.
 */
export type KnownStatus =
  | `${EContractStatus}`
  | `${EFromStatus}`
  | `${EToStatus}`
  | `${EInvitationStatus}`
  | `${ECompanyUserStatus}`
  | `${ECompanyStatus}`
  | `${EContractSiteStatus}`
  | `${EDocumentUploadStatus}`
  | ContractInvitationStatus
  | typeof ARCHIVED_STATUS;

const STATUS_PRESENTATION: Record<
  KnownStatus,
  { label: string; tone: StatusTone }
> = {
  // Contract lifecycle and status history
  [EContractStatus.DRAFT]: { label: "Draft", tone: "neutral" },
  [EContractStatus.ACTIVE]: { label: "Active", tone: "success" },
  [EContractStatus.SUSPENDED]: { label: "Suspended", tone: "warning" },
  [EContractStatus.COMPLETED]: { label: "Completed", tone: "info" },
  [EToStatus.CANCELLED]: { label: "Cancelled", tone: "danger" },
  [EToStatus.UNDER_REVIEW]: { label: "Under review", tone: "warning" },
  [ARCHIVED_STATUS]: { label: "Archived", tone: "inactive" },
  // Company, contract-party, and contract-role invitations
  [EInvitationStatus.PENDING]: { label: "Pending", tone: "warning" },
  [EInvitationStatus.ACCEPTED]: { label: "Accepted", tone: "success" },
  [EInvitationStatus.DECLINED]: { label: "Declined", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
  [EInvitationStatus.EXPIRED]: { label: "Expired", tone: "inactive" },
  [EInvitationStatus.REVOKED]: { label: "Revoked", tone: "inactive" },
  // Company memberships and companies
  [ECompanyUserStatus.INACTIVE]: { label: "Inactive", tone: "inactive" },
  // Contract sites
  [EContractSiteStatus.PLANNED]: { label: "Planned", tone: "neutral" },
  [EContractSiteStatus.CLOSED]: { label: "Closed", tone: "inactive" },
  // Document file uploads
  [EDocumentUploadStatus.PENDING_UPLOAD]: {
    label: "Upload pending",
    tone: "warning",
  },
  [EDocumentUploadStatus.PROCESSING]: { label: "Checking file", tone: "info" },
  [EDocumentUploadStatus.AVAILABLE]: { label: "Available", tone: "success" },
  [EDocumentUploadStatus.FAILED]: { label: "Upload failed", tone: "danger" },
};

/** The badge variant that renders each tone. */
export const TONE_VARIANT = {
  neutral: "secondary",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
  inactive: "outline",
} as const satisfies Record<StatusTone, string>;

function isKnownStatus(status: string): status is KnownStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_PRESENTATION, status);
}

/**
 * The label and tone for a status value. An unmapped value is still shown
 * readably (`on_hold` becomes "On hold") in the neutral tone, never as the
 * raw enum string.
 */
export function getStatusPresentation(status: string | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  if (!status) return { label: "Unknown", tone: "neutral" };
  const key = status.trim().toLowerCase();
  if (isKnownStatus(key)) return STATUS_PRESENTATION[key];
  return { label: humanizeEnumValue(status), tone: "neutral" };
}

/**
 * The status a pending invitation effectively has: once its expiry has
 * passed it can no longer be accepted, so it is shown as expired.
 */
export function effectiveInvitationStatus(
  status: string,
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (status !== EInvitationStatus.PENDING || !expiresAt) return status;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry <= now.getTime()
    ? EInvitationStatus.EXPIRED
    : status;
}

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const { label, tone } = getStatusPresentation(status);
  return (
    <Badge
      variant={TONE_VARIANT[tone]}
      data-status={status ?? undefined}
      data-tone={tone}
      className={className}
    >
      {label}
    </Badge>
  );
}
