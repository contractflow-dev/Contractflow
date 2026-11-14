"use client";

import { useId, useState } from "react";
import { FolderKanban } from "lucide-react";
import type { AssignableContractWorkspace } from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { FormField } from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import { notifySuccess } from "@/lib/notify";
import {
  useAddContractWorkspaceMutation,
  useGetContractLifecyclePermissionsQuery,
  useGetContractWorkspaceRemovalImpactQuery,
  useGetContractWorkspacesQuery,
  useRemoveContractWorkspaceMutation,
} from "@/services/contractApi";
import { CONTRACT_WORKSPACES, workspaceMeta } from "../contract-workspaces";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The workspaces a contract has, and for the contract's managing Company
 * Administrator, adding and removing them. A workspace is configuration
 * only: people still need a contract role to enter it, and adding one gives
 * nobody access.
 */
export function ContractWorkspaceManagement({
  companyId,
  contractId,
  contractReference,
}: {
  companyId: string;
  contractId: string;
  contractReference: string;
}) {
  const fieldId = useId();
  const query = { companyId, contractId };
  const workspaces = useGetContractWorkspacesQuery(query);
  const permissions = useGetContractLifecyclePermissionsQuery(query);
  const canManage = permissions.currentData?.canManage === true;
  const [addWorkspace, addState] = useAddContractWorkspaceMutation();
  const [toAdd, setToAdd] = useState<AssignableContractWorkspace | "">("");
  const [toRemove, setToRemove] = useState<AssignableContractWorkspace | null>(
    null,
  );

  const enabled = CONTRACT_WORKSPACES.filter(({ id }) =>
    (workspaces.currentData ?? []).includes(id),
  );
  const addable = CONTRACT_WORKSPACES.filter(
    ({ id }) => !(workspaces.currentData ?? []).includes(id),
  );
  const selected = addable.some(({ id }) => id === toAdd) ? toAdd : "";

  async function add() {
    if (!selected || addState.isLoading) return;
    try {
      await addWorkspace({ ...query, workspace: selected }).unwrap();
      notifySuccess(
        `${workspaceMeta(selected).label} workspace added`,
        "Nobody has access yet: assign contract roles to give people access.",
      );
      setToAdd("");
      addState.reset();
    } catch {
      // Shown below the form through `addState.error`.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Contract workspaces</h2>
        </CardTitle>
        <CardDescription>
          The workspaces this contract uses. People enter a workspace only with
          a contract role in it, assigned separately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {workspaces.isLoading ? (
          <div
            role="status"
            aria-label="Loading contract workspaces"
            className="space-y-2"
          >
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : workspaces.error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {getApiErrorMessage(
                  workspaces.error,
                  "Unable to load contract workspaces.",
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void workspaces.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : enabled.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            This contract has no workspaces yet.
            {canManage ? " Add one below to start using it." : ""}
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {enabled.map((workspace) => (
              <li
                key={workspace.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <FolderKanban
                    className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{workspace.label} workspace</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {workspace.purpose}
                    </p>
                  </div>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    aria-label={`Remove the ${workspace.label} workspace`}
                    onClick={() => setToRemove(workspace.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage && !workspaces.isLoading && !workspaces.error ? (
          addable.length ? (
            <form
              aria-label="Add a workspace"
              className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void add();
              }}
            >
              <FormField
                id={`${fieldId}-add`}
                label="Add a workspace"
                className="sm:max-w-xs sm:flex-1"
              >
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full"
                    value={selected}
                    onChange={(event) => {
                      addState.reset();
                      setToAdd(
                        addable.find(({ id }) => id === event.target.value)
                          ?.id ?? "",
                      );
                    }}
                  >
                    <NativeSelectOption value="">
                      Choose a workspace
                    </NativeSelectOption>
                    {addable.map((workspace) => (
                      <NativeSelectOption
                        key={workspace.id}
                        value={workspace.id}
                      >
                        {workspace.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <Button
                type="submit"
                disabled={!selected || addState.isLoading}
                aria-busy={addState.isLoading || undefined}
              >
                {addState.isLoading ? "Adding…" : "Add workspace"}
              </Button>
            </form>
          ) : (
            <p className="border-t pt-5 text-sm text-muted-foreground">
              This contract uses every available workspace.
            </p>
          )
        ) : null}
        {addState.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {getApiErrorMessage(
                addState.error,
                "The workspace couldn't be added.",
              )}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      {toRemove ? (
        <RemoveWorkspaceDialog
          companyId={companyId}
          contractId={contractId}
          contractReference={contractReference}
          workspace={toRemove}
          onClose={() => setToRemove(null)}
        />
      ) : null}
    </Card>
  );
}

/**
 * Confirms removing a workspace, saying what it ends: the API's current
 * counts of roles and invitations in it, across every party.
 */
export function RemoveWorkspaceDialog({
  companyId,
  contractId,
  contractReference,
  workspace,
  onClose,
}: {
  companyId: string;
  contractId: string;
  contractReference: string;
  workspace: AssignableContractWorkspace;
  onClose: () => void;
}) {
  const query = { companyId, contractId, workspace };
  const impact = useGetContractWorkspaceRemovalImpactQuery(query, {
    refetchOnMountOrArgChange: true,
  });
  const [removeWorkspace, removeState] = useRemoveContractWorkspaceMutation();
  const label = workspaceMeta(workspace).label;
  const counts = impact.currentData;

  const consequences = counts
    ? counts.activeRoleAssignmentCount === 0 &&
      counts.pendingRoleInvitationCount === 0
      ? "Nobody holds a role in it and no role invitations are pending."
      : [
          counts.activeRoleAssignmentCount
            ? `${plural(counts.activeRoleAssignmentCount, "contract role")}${
                counts.workspaceAdminCount
                  ? `, including ${plural(counts.workspaceAdminCount, "workspace administrator")},`
                  : ""
              } will be revoked`
            : null,
          counts.pendingRoleInvitationCount
            ? `${plural(counts.pendingRoleInvitationCount, "pending role invitation")} will be revoked`
            : null,
        ]
          .filter(Boolean)
          .join(" and ") +
        ", for every company on the contract. Those people lose access straight away."
    : null;

  return (
    <ConfirmDialog
      open
      title={`Remove the ${label} workspace?`}
      description={
        <span className="space-y-2">
          <span className="block">
            {label} will be removed from {contractReference}.{" "}
            {impact.isFetching
              ? "Checking who has access…"
              : impact.error
                ? getApiErrorMessage(
                    impact.error,
                    "We couldn't check who has access to it.",
                  )
                : consequences}
          </span>
          <span className="block">
            Revoked roles and the workspace&apos;s records, documents and
            history are kept. Adding the workspace again gives nobody access
            back: roles must be assigned again.
          </span>
        </span>
      }
      error={
        removeState.error
          ? getApiErrorMessage(
              removeState.error,
              "The workspace couldn't be removed.",
            )
          : undefined
      }
      confirmLabel="Remove workspace"
      pendingLabel="Removing…"
      // Not until the impact is known, so the user confirms what it ends.
      confirmDisabled={!counts}
      isPending={removeState.isLoading}
      destructive
      onCancel={onClose}
      onConfirm={() => {
        void removeWorkspace(query)
          .unwrap()
          .then(() => {
            notifySuccess(
              `${label} workspace removed`,
              counts?.activeRoleAssignmentCount
                ? `${plural(counts.activeRoleAssignmentCount, "contract role")} revoked.`
                : undefined,
            );
            onClose();
          })
          .catch(() => {
            // Shown in the dialog through `removeState.error`.
          });
      }}
    />
  );
}
