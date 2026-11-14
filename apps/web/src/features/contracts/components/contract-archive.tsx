"use client";

import { useId, useState } from "react";
import { Archive } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDateTime } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useArchiveContractMutation,
  useGetContractDeletionImpactQuery,
  useGetContractLifecyclePermissionsQuery,
  useRestoreContractMutation,
  type Contract,
} from "@/services/contractApi";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Confirms archiving (deleting) a contract. It names the contract, says what
 * ends with the API's current counts, and needs the reference typed, so one
 * stray click can't archive it. Nothing is deleted and it can be restored.
 */
export function ArchiveContractDialog({
  companyId,
  contract,
  onCancel,
  onArchived,
}: {
  companyId: string;
  contract: Pick<Contract, "id" | "referenceNumber" | "title">;
  onCancel: () => void;
  onArchived: () => void;
}) {
  const inputId = useId();
  const query = { companyId, contractId: contract.id };
  const impact = useGetContractDeletionImpactQuery(query, {
    refetchOnMountOrArgChange: true,
  });
  const [archive, archiveState] = useArchiveContractMutation();
  const [typed, setTyped] = useState("");
  const counts = impact.currentData;
  const confirmed = typed.trim() === contract.referenceNumber;

  const ends = counts
    ? [
        counts.activeRoleAssignmentCount
          ? `${plural(counts.activeRoleAssignmentCount, "contract role")}${
              counts.workspaceAdminCount
                ? ` (${plural(counts.workspaceAdminCount, "workspace administrator")})`
                : ""
            }`
          : null,
        counts.pendingRoleInvitationCount
          ? plural(counts.pendingRoleInvitationCount, "pending role invitation")
          : null,
        counts.pendingPartyInvitationCount
          ? plural(
              counts.pendingPartyInvitationCount,
              "pending company invitation",
            )
          : null,
      ].filter((item): item is string => Boolean(item))
    : [];

  return (
    <ConfirmDialog
      open
      title={`Archive ${contract.referenceNumber}?`}
      description={
        <span className="space-y-2">
          <span className="block">
            <span className="font-medium text-foreground">
              {contract.referenceNumber} · {contract.title}
            </span>{" "}
            will be removed from the contract register and every contract view,
            and all access to it ends.
          </span>
          <span className="block">
            {impact.isFetching
              ? "Checking what this affects…"
              : impact.error
                ? getApiErrorMessage(
                    impact.error,
                    "We couldn't check what archiving affects.",
                  )
                : counts
                  ? `${
                      ends.length
                        ? `It revokes ${ends.join(", ")}, for every company on the contract.`
                        : "Nobody holds a role on it and no invitations are pending."
                    }${
                      counts.otherPartyCount
                        ? ` ${plural(counts.otherPartyCount, "other company")} will no longer see it.`
                        : ""
                    }${
                      counts.subcontractCount
                        ? ` Its ${plural(counts.subcontractCount, "subcontract")} stay active.`
                        : ""
                    }`
                  : null}
          </span>
          <span className="block">
            Nothing is deleted: its parties, workspaces, sites, records,
            documents and history are kept. You can restore it from &ldquo;Show
            archived contracts only&rdquo; in the register, but roles must then
            be assigned again.
          </span>
        </span>
      }
      error={
        archiveState.error
          ? getApiErrorMessage(
              archiveState.error,
              "Unable to archive the contract.",
            )
          : undefined
      }
      confirmLabel="Archive contract"
      pendingLabel="Archiving…"
      // Not until the impact is known and the reference is typed.
      confirmDisabled={!counts || !confirmed}
      isPending={archiveState.isLoading}
      destructive
      onCancel={onCancel}
      onConfirm={() => {
        if (!confirmed || !counts) return;
        void archive(query)
          .unwrap()
          .then(() => {
            notifySuccess(
              "Contract archived",
              `${contract.referenceNumber} · ${contract.title} was archived. You can restore it from the contract register.`,
            );
            onArchived();
          })
          .catch(() => {
            // Shown in the dialog through `archiveState.error`.
          });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          Type <span className="font-mono">{contract.referenceNumber}</span> to
          confirm
        </label>
        <Input
          id={inputId}
          value={typed}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}

/**
 * Restores an archived contract with one button: the same contract, with its
 * records, comes back to the register. No roles come back with it.
 */
export function RestoreContractButton({
  companyId,
  contract,
  size = "sm",
}: {
  companyId: string;
  contract: Pick<Contract, "id" | "referenceNumber" | "title">;
  size?: "sm" | "default";
}) {
  const [restore, state] = useRestoreContractMutation();

  async function restoreContract() {
    if (state.isLoading) return;
    try {
      await restore({ companyId, contractId: contract.id }).unwrap();
      notifySuccess(
        "Contract restored",
        `${contract.referenceNumber} · ${contract.title} is back in the contract register. Assign roles again to give members access.`,
      );
    } catch {
      // Shown below the button through `state.error`.
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={state.isLoading}
        aria-busy={state.isLoading || undefined}
        aria-label={`Restore ${contract.referenceNumber} · ${contract.title}`}
        onClick={() => void restoreContract()}
      >
        {state.isLoading ? "Restoring…" : "Restore"}
      </Button>
      {state.error ? (
        <p role="alert" className="max-w-56 text-xs text-destructive">
          {getApiErrorMessage(state.error, "Unable to restore contract.")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shown on an archived contract's pages: it is read-only history. Its
 * restore button is offered only when the API says the viewer may restore.
 */
export function ArchivedContractNotice({
  companyId,
  contract,
}: {
  companyId: string;
  contract: Pick<Contract, "id" | "referenceNumber" | "title" | "deletedAt">;
}) {
  const permissions = useGetContractLifecyclePermissionsQuery({
    companyId,
    contractId: contract.id,
  });
  if (!contract.deletedAt) return null;
  return (
    <Alert role="status">
      <Archive aria-hidden="true" />
      <AlertTitle>Archived contract · read-only</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Archived {formatDateTime(contract.deletedAt)}. It is out of the
          contract register and nobody has access to its workspaces. Its
          details, parties, workspaces and history are kept for reference and
          can&apos;t be changed.
        </p>
        {permissions.currentData?.canRestore ? (
          <RestoreContractButton
            companyId={companyId}
            contract={contract}
            size="default"
          />
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
