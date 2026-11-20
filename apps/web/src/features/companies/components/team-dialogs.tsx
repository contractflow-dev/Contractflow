"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EInvitationStatus } from "@contractflow/contracts-schema";
import { RiUserAddLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { DataTable, DataTableEmpty } from "@/components/data-table/data-table";
import {
  StatusBadge,
  effectiveInvitationStatus,
} from "@/components/status-badge/status-badge";
import {
  StatusLegendDisclosure,
  type StatusLegendItem,
} from "@/components/status-badge/status-legend";
import { useKeepPageInRange, usePagination } from "@/hooks/use-pagination";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  useGetCompanyInvitationsQuery,
  useResendCompanyInvitationMutation,
  useRevokeCompanyInvitationMutation,
} from "@/features/companies";
import { TEAM_DIALOGS, type TeamDialog } from "../company-navigation";
import { InviteMemberDialog } from "./invite-member-dialog";

/**
 * The Team dialog named by `?dialog=` (invitations or invite), so the Team
 * sub-navigation and buttons on either Team page can open one, and Back
 * closes it. Other query parameters, such as `?workspace=`, are kept.
 */
export function useTeamDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("dialog");
  const dialog: TeamDialog | null =
    TEAM_DIALOGS.find((name) => name === value) ?? null;

  function hrefWith(next: TeamDialog | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("dialog", next);
    else params.delete("dialog");
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }

  return {
    dialog,
    /** Opening adds a history entry, so Back closes the dialog. */
    open: (next: TeamDialog) => router.push(hrefWith(next), { scroll: false }),
    close: () => router.replace(hrefWith(null), { scroll: false }),
  };
}

/** The Team pages' dialogs, opened from the URL. */
export function TeamDialogs({ companyId }: { companyId: string }) {
  const { dialog, open, close } = useTeamDialog();
  return (
    <>
      <InvitationsDialog
        companyId={companyId}
        open={dialog === "invitations"}
        onClose={close}
        onInvite={() => open("invite")}
      />
      <InviteMemberDialog
        companyId={companyId}
        open={dialog === "invite"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      />
    </>
  );
}

/** What each company invitation status means for the person invited. */
const invitationStatusLegend: StatusLegendItem[] = [
  {
    status: EInvitationStatus.PENDING,
    description: "Sent and waiting for a response. It can still be revoked.",
  },
  {
    status: EInvitationStatus.ACCEPTED,
    description: "The recipient accepted and joined the company.",
  },
  {
    status: EInvitationStatus.DECLINED,
    description: "The recipient declined the invitation.",
  },
  {
    status: EInvitationStatus.EXPIRED,
    description: "Not accepted within seven days. The link no longer works.",
  },
  {
    status: EInvitationStatus.REVOKED,
    description: "Cancelled by an administrator. The link no longer works.",
  },
];

/** The company's invitations, with Resend and Revoke, in a dialog. */
export function InvitationsDialog({
  companyId,
  open,
  onClose,
  onInvite,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
  onInvite: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-4 sm:max-w-3xl">
        {/* Mounted only while open, so the list loads when it's asked for. */}
        {open ? (
          <InvitationsContent companyId={companyId} onInvite={onInvite} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InvitationsContent({
  companyId,
  onInvite,
}: {
  companyId: string;
  onInvite: () => void;
}) {
  const timeZone = useUserTimeZone();
  const pages = usePagination(10);
  const {
    currentData: invitations,
    error,
    isLoading: initialLoading,
    isFetching,
    refetch,
  } = useGetCompanyInvitationsQuery({
    companyId,
    page: pages.page,
    limit: pages.limit,
  });
  const loading = initialLoading || (isFetching && !invitations);
  useKeepPageInRange(invitations?.meta, pages.setPage);
  const [revokeInvitation, revokeState] = useRevokeCompanyInvitationMutation();
  const [resendInvitation] = useResendCompanyInvitationMutation();
  const [resendingId, setResendingId] = useState("");
  // The confirmation keeps its target open with the last failure, so a
  // failed request stays in the dialog until it succeeds or is cancelled.
  const [toRevoke, setToRevoke] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [revokeError, setRevokeError] = useState("");

  // A new link replaces the old one, which stops working.
  async function resend(invitationId: string, invitedEmail: string) {
    if (resendingId) return;
    setResendingId(invitationId);
    try {
      await resendInvitation({ companyId, invitationId }).unwrap();
      notifySuccess(
        "Invitation sent again",
        `${invitedEmail} has a new link, valid for 7 days. The previous link no longer works.`,
      );
    } catch (failure) {
      notifyError(
        failure,
        "Please try again in a moment.",
        "The invitation could not be sent again",
      );
    } finally {
      setResendingId("");
    }
  }

  async function confirmRevocation() {
    if (!toRevoke || revokeState.isLoading) return;
    const invitation = toRevoke;
    setRevokeError("");
    try {
      await revokeInvitation({
        companyId,
        invitationId: invitation.id,
      }).unwrap();
      setToRevoke(null);
      notifySuccess(
        "Invitation revoked",
        `The invitation for ${invitation.email} no longer works.`,
      );
    } catch (failure) {
      setRevokeError(
        getApiErrorMessage(failure, "The invitation could not be revoked."),
      );
    }
  }

  const revokingId = revokeState.isLoading ? toRevoke?.id : undefined;

  return (
    <>
      <DialogHeader className="pe-8">
        <DialogTitle>Invitations</DialogTitle>
        <DialogDescription>
          Invitations sent from this company and where each one stands.
        </DialogDescription>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusLegendDisclosure
            label="What do invitation statuses mean?"
            items={invitationStatusLegend}
          />
          <Button
            type="button"
            size="sm"
            aria-haspopup="dialog"
            onClick={onInvite}
          >
            <RiUserAddLine aria-hidden="true" data-icon="inline-start" />
            Invite member
          </Button>
        </div>
      </DialogHeader>

      <div className="-mx-6 min-h-0 overflow-y-auto border-t px-6 pt-4">
        <DataTable
          label="Invitations"
          columns={[
            {
              id: "recipient",
              header: "Recipient",
              wrap: true,
              className: "min-w-40",
              cell: (invitation) => (
                <>
                  <p className="font-medium">
                    {invitation.firstName || invitation.lastName
                      ? [invitation.firstName, invitation.lastName]
                          .filter(Boolean)
                          .join(" ")
                      : "Invitee"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {invitation.email}
                  </p>
                  <p className="text-xs text-muted-foreground sm:hidden">
                    {invitation.companyRole}
                  </p>
                  <p className="text-xs text-muted-foreground md:hidden">
                    Expires {formatDate(invitation.expiresAt, { timeZone })}
                  </p>
                </>
              ),
            },
            {
              id: "role",
              header: "Role",
              hideBelow: "sm",
              cell: (invitation) => invitation.companyRole,
            },
            {
              id: "status",
              header: "Status",
              cell: (invitation) => (
                <StatusBadge
                  status={effectiveInvitationStatus(
                    invitation.status,
                    invitation.expiresAt,
                  )}
                />
              ),
            },
            {
              id: "expires",
              header: "Expires",
              hideBelow: "md",
              className: "tabular-nums",
              cell: (invitation) =>
                formatDate(invitation.expiresAt, { timeZone }),
            },
          ]}
          rows={invitations?.data ?? []}
          getRowKey={(invitation) => invitation.id}
          rowActions={(invitation) => (
            <>
              {(invitation.status === EInvitationStatus.PENDING ||
                invitation.status === EInvitationStatus.EXPIRED) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    Boolean(resendingId) || revokingId === invitation.id
                  }
                  onClick={() => void resend(invitation.id, invitation.email)}
                  aria-label={`Send the invitation to ${invitation.email} again`}
                >
                  {resendingId === invitation.id ? "Sending…" : "Resend"}
                </Button>
              )}
              {invitation.status === EInvitationStatus.PENDING &&
                new Date(invitation.expiresAt) > new Date() && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokingId === invitation.id}
                    onClick={() => {
                      setRevokeError("");
                      setToRevoke({
                        id: invitation.id,
                        email: invitation.email,
                      });
                    }}
                  >
                    {revokingId === invitation.id ? "Revoking…" : "Revoke"}
                  </Button>
                )}
            </>
          )}
          isLoading={loading}
          loadingLabel="Loading invitations…"
          skeletonRows={3}
          error={
            error
              ? `Invitations could not be loaded. ${getApiErrorMessage(
                  error,
                  "Please try again.",
                )}`
              : null
          }
          onRetry={() => void refetch()}
          empty={<DataTableEmpty title="No invitations have been sent." />}
          pagination={
            invitations
              ? {
                  meta: invitations.meta,
                  itemLabel: "invitations",
                  isFetching,
                  onPageChange: pages.setPage,
                  onPageSizeChange: pages.setLimit,
                }
              : undefined
          }
        />
      </div>

      {/* Inside the dialog, so it stacks over the list as a nested dialog. */}
      <ConfirmDialog
        open={toRevoke !== null}
        title="Revoke this invitation?"
        description={
          toRevoke
            ? `The invitation sent to ${toRevoke.email} will stop working. This can't be undone, but you can send a new invitation.`
            : ""
        }
        confirmLabel="Revoke invitation"
        pendingLabel="Revoking…"
        isPending={revokeState.isLoading}
        error={toRevoke ? revokeError : undefined}
        destructive
        onConfirm={() => void confirmRevocation()}
        onCancel={() => setToRevoke(null)}
      />
    </>
  );
}
