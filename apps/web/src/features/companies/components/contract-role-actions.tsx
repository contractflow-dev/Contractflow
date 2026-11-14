"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useRevokeContractRoleMutation,
  useSetContractWorkspaceAdminMutation,
  type CompanyRoleAssignment,
} from "@/services/contractApi";

const memberName = (row: CompanyRoleAssignment) =>
  `${row.firstName} ${row.lastName}`.trim() || row.email;

/**
 * Workspace-administrator and revoke actions for one contract role. Both go
 * through the contract's own routes, so the API applies the contract's
 * checks, including that a workspace keeps at least one administrator.
 */
export function ContractRoleActions({
  companyId,
  row,
}: {
  companyId: string;
  row: CompanyRoleAssignment;
}) {
  const [confirming, setConfirming] = useState<"revoke" | "admin" | null>(null);
  const [revoke, revokeState] = useRevokeContractRoleMutation();
  const [setWorkspaceAdmin, adminState] =
    useSetContractWorkspaceAdminMutation();
  const name = memberName(row);
  const busy = revokeState.isLoading || adminState.isLoading;
  const workspaceLabel = humanizeEnumValue(row.workspace);

  async function changeWorkspaceAdmin() {
    try {
      await setWorkspaceAdmin({
        companyId,
        contractId: row.contractId,
        workspace: row.workspace,
        assignmentId: row.id,
        isWorkspaceAdmin: !row.isWorkspaceAdmin,
      }).unwrap();
      setConfirming(null);
      notifySuccess(
        row.isWorkspaceAdmin
          ? "Workspace administrator removed"
          : "Workspace administrator granted",
        row.isWorkspaceAdmin
          ? `${name} no longer administers the ${workspaceLabel} workspace on ${row.contractTitle}.`
          : `${name} can now manage the ${workspaceLabel} workspace on ${row.contractTitle}.`,
      );
    } catch {
      // Shown in the open dialog through `adminState.error`.
    }
  }

  async function confirmRevoke() {
    try {
      await revoke({
        companyId,
        contractId: row.contractId,
        workspace: row.workspace,
        assignmentId: row.id,
      }).unwrap();
      setConfirming(null);
      notifySuccess(
        "Contract role revoked",
        `${row.role} on ${row.contractTitle}`,
      );
    } catch {
      // Shown in the dialog through `revokeState.error`.
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        aria-label={
          row.isWorkspaceAdmin
            ? `Remove workspace administrator rights from ${name} for ${workspaceLabel} on ${row.contractTitle}`
            : `Make ${name} workspace administrator for ${workspaceLabel} on ${row.contractTitle}`
        }
        onClick={() => {
          adminState.reset();
          setConfirming("admin");
        }}
      >
        {row.isWorkspaceAdmin ? "Remove admin" : "Make admin"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={busy}
        aria-label={`Revoke ${row.role} from ${name} on ${row.contractTitle}`}
        onClick={() => {
          revokeState.reset();
          setConfirming("revoke");
        }}
      >
        Revoke
      </Button>

      <ConfirmDialog
        open={confirming === "admin"}
        title={
          row.isWorkspaceAdmin
            ? "Remove workspace administrator rights?"
            : "Make this member a workspace administrator?"
        }
        description={
          row.isWorkspaceAdmin
            ? `${name} keeps the ${row.role} role but can no longer assign or revoke roles in the ${workspaceLabel} workspace on “${row.contractTitle}”.`
            : `${name} will be able to assign and revoke roles in the ${workspaceLabel} workspace on “${row.contractTitle}” only. This gives no rights in other workspaces, other contracts or the company.`
        }
        error={
          adminState.error
            ? getApiErrorMessage(
                adminState.error,
                "Workspace administrator rights couldn't be changed.",
              )
            : undefined
        }
        confirmLabel={
          row.isWorkspaceAdmin ? "Remove admin rights" : "Make admin"
        }
        pendingLabel="Saving…"
        isPending={adminState.isLoading}
        destructive={row.isWorkspaceAdmin}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void changeWorkspaceAdmin()}
      />

      <ConfirmDialog
        open={confirming === "revoke"}
        title="Revoke this contract role?"
        description={`${name} will lose the ${row.role} role on “${row.contractTitle}” straight away. Records they created stay on the contract.`}
        error={
          revokeState.error
            ? getApiErrorMessage(
                revokeState.error,
                "The role couldn't be revoked.",
              )
            : undefined
        }
        confirmLabel="Revoke role"
        pendingLabel="Revoking…"
        isPending={revokeState.isLoading}
        destructive
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirmRevoke()}
      />
    </div>
  );
}
