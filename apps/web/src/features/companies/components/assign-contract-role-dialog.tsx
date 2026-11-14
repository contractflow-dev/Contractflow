"use client";

import { useId, useState, type FormEvent } from "react";
import {
  ECompanyUserStatus,
  EContractSortField,
  ESortOrder,
  type ContractRole,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { FormField } from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import { humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { useGetCompanyMembersQuery } from "@/services/companiesApi";
import {
  useAssignContractRoleMutation,
  useGetContractRoleManagementPermissionsQuery,
  useGetContractWorkspacesQuery,
  useGetContractsQuery,
  type AssignableContractWorkspace,
} from "@/services/contractApi";

/** The API's largest page: enough options for these selectors. */
const OPTIONS_LIMIT = 100;

export interface AssignableMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const memberLabel = (member: AssignableMember) =>
  `${member.firstName} ${member.lastName}`.trim() || member.email;

/**
 * Gives a company member a role in one workspace of one of the company's
 * contracts. Each choice narrows the next: the contracts the company is a
 * party to, that contract's enabled workspaces, then the roles the API offers
 * for the company's side. The API checks every value again when submitted.
 */
export function AssignContractRoleDialog({
  companyId,
  open,
  onOpenChange,
  member,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixes the member (from their details); otherwise one is chosen here. */
  member?: AssignableMember;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remounted on every open, so it always starts empty. */}
        {open ? (
          <AssignContractRoleForm
            companyId={companyId}
            member={member}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** The form inside the dialog; exported for tests. */
export function AssignContractRoleForm({
  companyId,
  member,
  onDone,
}: {
  companyId: string;
  member?: AssignableMember;
  onDone: () => void;
}) {
  const formId = useId();
  const [companyUserId, setCompanyUserId] = useState(member?.id ?? "");
  const [contractId, setContractId] = useState("");
  const [workspace, setWorkspace] = useState<AssignableContractWorkspace | "">(
    "",
  );
  const [role, setRole] = useState<ContractRole | "">("");
  const [isWorkspaceAdmin, setIsWorkspaceAdmin] = useState(false);
  const [failure, setFailure] = useState("");

  const members = useGetCompanyMembersQuery(
    {
      companyId,
      page: 1,
      limit: OPTIONS_LIMIT,
      status: ECompanyUserStatus.ACTIVE,
    },
    { skip: Boolean(member) },
  );
  const contracts = useGetContractsQuery({
    companyId,
    page: 1,
    limit: OPTIONS_LIMIT,
    sortBy: EContractSortField.TITLE,
    sortOrder: ESortOrder.ASC,
  });
  const workspaces = useGetContractWorkspacesQuery(
    { companyId, contractId },
    { skip: !contractId },
  );
  const permissions = useGetContractRoleManagementPermissionsQuery(
    { companyId, contractId, workspace: workspace || "project" },
    { skip: !contractId || !workspace },
  );
  const [assign, assignState] = useAssignContractRoleMutation();

  const memberOptions = member ? [member] : (members.currentData?.data ?? []);
  const selectedMember = memberOptions.find(({ id }) => id === companyUserId);
  const contractOptions = contracts.currentData?.data ?? [];
  const selectedContract = contractOptions.find(({ id }) => id === contractId);
  const workspaceOptions = workspaces.currentData ?? [];
  const allowed = permissions.currentData;
  const roleOptions = allowed?.canManage ? allowed.roles : [];
  const canGrantWorkspaceAdmin = allowed?.canGrantWorkspaceAdmin === true;
  const ready = Boolean(
    companyUserId &&
    contractId &&
    workspace &&
    role &&
    roleOptions.includes(role),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || assignState.isLoading || !workspace || !role) return;
    setFailure("");
    try {
      await assign({
        companyId,
        contractId,
        workspace,
        companyUserId,
        role,
        isWorkspaceAdmin: isWorkspaceAdmin && canGrantWorkspaceAdmin,
      }).unwrap();
      notifySuccess(
        "Contract role assigned",
        `${selectedMember ? memberLabel(selectedMember) : "The member"} is now ${role} on ${selectedContract?.title ?? "the contract"}${isWorkspaceAdmin && canGrantWorkspaceAdmin ? ", as workspace administrator" : ""}.`,
      );
      onDone();
    } catch (error) {
      setFailure(getApiErrorMessage(error, "The role couldn't be assigned."));
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      aria-label="Assign a contract role"
      className="space-y-5"
    >
      <DialogHeader>
        <DialogTitle>Assign to a contract</DialogTitle>
        <DialogDescription>
          Gives access to one workspace of one contract. Company membership
          alone doesn&apos;t give access to any contract.
        </DialogDescription>
      </DialogHeader>

      {member ? (
        <p className="rounded-lg border px-3 py-2 text-sm">
          <span className="text-muted-foreground">Member: </span>
          <span className="font-medium">{memberLabel(member)}</span>{" "}
          <span className="text-muted-foreground">({member.email})</span>
        </p>
      ) : (
        <FormField id={`${formId}-member`} label="Member">
          {(control) => (
            <NativeSelect
              {...control}
              className="w-full"
              value={companyUserId}
              disabled={members.isLoading}
              onChange={(event) => setCompanyUserId(event.target.value)}
            >
              <NativeSelectOption value="">
                {members.isLoading ? "Loading members…" : "Choose a member"}
              </NativeSelectOption>
              {memberOptions.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {memberLabel(option)} ({option.email})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}

      <FormField
        id={`${formId}-contract`}
        label="Contract"
        description="Only contracts your company is a party to."
        error={
          contracts.error
            ? getApiErrorMessage(
                contracts.error,
                "Contracts couldn't be loaded.",
              )
            : !contracts.isLoading && contractOptions.length === 0
              ? "Your company isn't a party to any contract yet."
              : undefined
        }
      >
        {(control) => (
          <NativeSelect
            {...control}
            className="w-full"
            value={contractId}
            disabled={contracts.isLoading || contractOptions.length === 0}
            onChange={(event) => {
              setContractId(event.target.value);
              setWorkspace("");
              setRole("");
              setIsWorkspaceAdmin(false);
              setFailure("");
            }}
          >
            <NativeSelectOption value="">
              {contracts.isLoading ? "Loading contracts…" : "Choose a contract"}
            </NativeSelectOption>
            {contractOptions.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.title} · {option.referenceNumber} (
                {humanizeEnumValue(option.status)})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField
        id={`${formId}-workspace`}
        label="Workspace"
        description={
          contractId && !workspaces.isFetching && workspaceOptions.length === 0
            ? "This contract has no workspaces enabled yet."
            : "Only workspaces enabled on this contract."
        }
      >
        {(control) => (
          <NativeSelect
            {...control}
            className="w-full"
            value={workspace}
            disabled={!contractId || workspaces.isFetching}
            onChange={(event) => {
              setWorkspace(
                workspaceOptions.find(
                  (option) => option === event.target.value,
                ) ?? "",
              );
              setRole("");
              setIsWorkspaceAdmin(false);
              setFailure("");
            }}
          >
            <NativeSelectOption value="">Choose a workspace</NativeSelectOption>
            {workspaceOptions.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {humanizeEnumValue(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField
        id={`${formId}-role`}
        label="Contract role"
        description={
          allowed
            ? `Roles for your company's ${allowed.roleSide} side of this contract.`
            : undefined
        }
        error={
          permissions.error
            ? getApiErrorMessage(
                permissions.error,
                "Roles for this workspace couldn't be loaded.",
              )
            : allowed && !allowed.canManage
              ? "You can't assign roles in this workspace."
              : undefined
        }
      >
        {(control) => (
          <NativeSelect
            {...control}
            className="w-full"
            value={role}
            disabled={
              !workspace || permissions.isFetching || !roleOptions.length
            }
            onChange={(event) =>
              setRole(
                roleOptions.find((option) => option === event.target.value) ??
                  "",
              )
            }
          >
            <NativeSelectOption value="">Choose a role</NativeSelectOption>
            {roleOptions.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>

      {canGrantWorkspaceAdmin && roleOptions.length > 0 ? (
        <label
          htmlFor={`${formId}-workspace-admin`}
          className="flex items-start gap-3 rounded-lg border p-3 text-sm"
        >
          <Checkbox
            id={`${formId}-workspace-admin`}
            checked={isWorkspaceAdmin}
            onCheckedChange={(checked) => setIsWorkspaceAdmin(checked === true)}
          />
          <span className="space-y-1">
            <span className="block font-medium">
              Make them workspace administrator
            </span>
            <span className="block text-muted-foreground">
              They can assign and revoke roles in this workspace of this
              contract only. It gives no other workspace or company rights.
            </span>
          </span>
        </label>
      ) : null}

      {failure ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!ready || assignState.isLoading}
          aria-busy={assignState.isLoading || undefined}
        >
          {assignState.isLoading ? "Assigning…" : "Assign role"}
        </Button>
      </DialogFooter>
    </form>
  );
}
