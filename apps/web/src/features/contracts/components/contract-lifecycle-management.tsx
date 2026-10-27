"use client";

import { useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import {
  ECompanyRole,
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
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
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";
import { getApiErrorMessage } from "@/lib/apiError";
import { useGetCompanyMembershipQuery } from "@/features/companies/companiesApi";
import {
  useArchiveContractMutation,
  useCreateContractMutation,
  useCreateContractPartyInvitationMutation,
  useGetContractLifecyclePermissionsQuery,
  useGetContractPartyInvitationsQuery,
  useGetContractWorkspacesQuery,
  useRevokeContractPartyInvitationMutation,
  useTransitionContractMutation,
  useUpdateContractMutation,
  useUpdateContractWorkspacesMutation,
  type AssignableContractWorkspace,
  type Contract,
  type ContractTransition,
  type CreateContractRequest,
} from "@/services/contractApi";

const workspaces: AssignableContractWorkspace[] = ["project", "hse", "finance"];

const transitionOptions: Record<
  EContractStatus,
  Array<{ transition: ContractTransition; label: string }>
> = {
  [EContractStatus.DRAFT]: [{ transition: "activate", label: "Activate" }],
  [EContractStatus.ACTIVE]: [
    { transition: "hold", label: "Suspend" },
    { transition: "complete", label: "Complete" },
  ],
  [EContractStatus.SUSPENDED]: [{ transition: "resume", label: "Resume" }],
  [EContractStatus.COMPLETED]: [],
};

export function CreateContractForm({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const membershipQuery = useGetCompanyMembershipQuery({ companyId });
  const [createContract, createState] = useCreateContractMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedWorkspaces = workspaces.filter((workspace) =>
      form.getAll("workspaces").includes(workspace),
    );
    const body: CreateContractRequest = {
      referenceNumber: String(form.get("referenceNumber") ?? "").trim(),
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || null,
      contractType: String(form.get("contractType")) as EContractType,
      partyType: String(form.get("partyType")) as EPartyType,
      workspaces: selectedWorkspaces,
      originalValueMinor: Number(form.get("originalValueMinor")),
      currencyCode: String(form.get("currencyCode")) as ECurrencyCode,
      retentionRateBps: Number(form.get("retentionRateBps")),
      advancePaymentRateBps: numberOrNull(form.get("advancePaymentRateBps")),
      paymentTermsDays: Number(form.get("paymentTermsDays")),
      liquidatedDamagesPerDayMinor: numberOrNull(
        form.get("liquidatedDamagesPerDayMinor"),
      ),
      awardDate: String(form.get("awardDate")),
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate")),
      revisedEndDate: String(form.get("revisedEndDate")) || null,
      actualCompletionDate: String(form.get("actualCompletionDate")) || null,
      defectsLiabilityDays: Number(form.get("defectsLiabilityDays")),
      timezone: String(form.get("timezone")).trim(),
    };

    const result = await createContract({ companyId, body });
    if ("error" in result) return;
    formElement.reset();
    setOpen(false);
  }

  if (membershipQuery.isLoading) return null;
  if (membershipQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getApiErrorMessage(
            membershipQuery.error,
            "Unable to verify contract creation access.",
          )}
        </AlertDescription>
      </Alert>
    );
  }
  if (
    membershipQuery.data?.membership.companyRole !== ECompanyRole.COMPANY_ADMIN
  ) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Contract setup</CardTitle>
          <CardDescription>
            Create a draft contract for this company.
          </CardDescription>
        </div>
        <Button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "New contract"}
        </Button>
      </CardHeader>
      {open ? (
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormInput
                name="referenceNumber"
                label="Reference number"
                required
                maxLength={40}
              />
              <FormInput name="title" label="Title" required maxLength={255} />
              <FormSelect
                name="contractType"
                label="Contract type"
                values={Object.values(EContractType)}
              />
              <FormSelect
                name="partyType"
                label="Creating company party type"
                values={Object.values(EPartyType)}
              />
              <FormInput
                name="originalValueMinor"
                label="Original value (minor currency units)"
                type="number"
                min="0"
                required
              />
              <FormSelect
                name="currencyCode"
                label="Currency"
                values={Object.values(ECurrencyCode)}
                defaultValue={ECurrencyCode.USD}
              />
              <FormInput
                name="retentionRateBps"
                label="Retention (basis points)"
                type="number"
                min="0"
                max="10000"
                defaultValue="0"
                required
              />
              <FormInput
                name="advancePaymentRateBps"
                label="Advance payment (basis points)"
                type="number"
                min="0"
                max="10000"
              />
              <FormInput
                name="paymentTermsDays"
                label="Payment terms (days)"
                type="number"
                min="0"
                defaultValue="30"
                required
              />
              <FormInput
                name="liquidatedDamagesPerDayMinor"
                label="Liquidated damages per day (minor units)"
                type="number"
                min="0"
              />
              <FormInput
                name="awardDate"
                label="Award date"
                type="date"
                required
              />
              <FormInput
                name="startDate"
                label="Start date"
                type="date"
                required
              />
              <FormInput name="endDate" label="End date" type="date" required />
              <FormInput
                name="revisedEndDate"
                label="Revised end date"
                type="date"
              />
              <FormInput
                name="actualCompletionDate"
                label="Actual completion date"
                type="date"
              />
              <FormInput
                name="defectsLiabilityDays"
                label="Defects liability (days)"
                type="number"
                min="0"
                defaultValue="0"
                required
              />
              <FormInput
                name="timezone"
                label="Timezone"
                defaultValue="UTC"
                required
                maxLength={64}
              />
            </div>
            <Field>
              <FieldLabel htmlFor="new-contract-description">
                Description
              </FieldLabel>
              <Textarea id="new-contract-description" name="description" />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Workspaces</legend>
              <div className="flex flex-wrap gap-4">
                {workspaces.map((workspace) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={workspace}
                  >
                    <input
                      type="checkbox"
                      name="workspaces"
                      value={workspace}
                      defaultChecked
                    />
                    {formatLabel(workspace)}
                  </label>
                ))}
              </div>
            </fieldset>
            {createState.error ? (
              <ErrorAlert
                error={createState.error}
                fallback="Unable to create the contract."
              />
            ) : null}
            <Button type="submit" disabled={createState.isLoading}>
              {createState.isLoading ? "Creating…" : "Create draft Contract"}
            </Button>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function ContractLifecycleManagement({
  companyId,
  contract,
}: {
  companyId: string;
  contract: Contract;
}) {
  const query = { companyId, contractId: contract.id };
  const permissionsQuery = useGetContractLifecyclePermissionsQuery(query);
  const permissions = permissionsQuery.data;
  const workspacesQuery = useGetContractWorkspacesQuery(query, {
    skip: !permissions?.canManage,
  });
  const invitationsQuery = useGetContractPartyInvitationsQuery(query, {
    skip: !permissions?.canManage,
  });
  const [updateContract, updateState] = useUpdateContractMutation();
  const [updateWorkspaces, workspaceState] =
    useUpdateContractWorkspacesMutation();
  const [transitionContract, transitionState] = useTransitionContractMutation();
  const [archiveContract, archiveState] = useArchiveContractMutation();
  const [createInvitation, invitationState] =
    useCreateContractPartyInvitationMutation();
  const [revokeInvitation, revokeInvitationState] =
    useRevokeContractPartyInvitationMutation();
  const router = useRouter();
  const [title, setTitle] = useState(contract.title);
  const [description, setDescription] = useState(contract.description ?? "");
  const [reason, setReason] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteType, setInviteType] = useState<EPartyType>(
    EPartyType.CONTRACTOR,
  );
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<
    AssignableContractWorkspace[] | null
  >(null);
  const activeWorkspaces =
    selectedWorkspaces ?? workspacesQuery.currentData ?? [];

  if (permissionsQuery.isLoading) return null;
  if (permissionsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getApiErrorMessage(
            permissionsQuery.error,
            "Unable to verify contract lifecycle access.",
          )}
        </AlertDescription>
      </Alert>
    );
  }
  if (!permissions || (!permissions.canManage && !permissions.canTransition)) {
    return null;
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateContract({
      ...query,
      body: { title: title.trim(), description: description.trim() || null },
    });
  }

  async function saveWorkspaces() {
    const result = await updateWorkspaces({
      ...query,
      workspaces: activeWorkspaces,
    });
    if (!("error" in result)) setSelectedWorkspaces(null);
  }

  async function transition(
    event: FormEvent<HTMLFormElement>,
    action: ContractTransition,
  ) {
    event.preventDefault();
    const result = await transitionContract({
      ...query,
      transition: action,
      reason: reason.trim(),
    });
    if (!("error" in result)) setReason("");
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await createInvitation({
      ...query,
      email: inviteEmail.trim(),
      partyType: inviteType,
    });
    if (!("error" in result)) setInviteEmail("");
  }

  return (
    <section className="space-y-5" aria-label="Contract lifecycle management">
      <Card>
        <CardHeader>
          <CardTitle>Manage contract</CardTitle>
          <CardDescription>
            Draft details, workspace availability, and lifecycle actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {permissions.canManage ? (
            <>
              <form
                onSubmit={saveDetails}
                className="grid gap-4 sm:grid-cols-2"
              >
                <Field>
                  <FieldLabel htmlFor="contract-title">Title</FieldLabel>
                  <Input
                    id="contract-title"
                    value={title}
                    maxLength={255}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contract-description">
                    Description
                  </FieldLabel>
                  <Textarea
                    id="contract-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={updateState.isLoading}>
                    Save details
                  </Button>
                </div>
              </form>
              {updateState.error ? (
                <ErrorAlert
                  error={updateState.error}
                  fallback="Unable to update contract details."
                />
              ) : null}

              <div className="space-y-3 border-t pt-5">
                <div>
                  <h3 className="text-sm font-semibold">
                    Available workspaces
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Removing a workspace revokes its active assignments and
                    pending invitations.
                  </p>
                </div>
                {workspacesQuery.error ? (
                  <ErrorAlert
                    error={workspacesQuery.error}
                    fallback="Unable to load contract workspaces."
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap gap-4">
                      {workspaces.map((workspace) => (
                        <label
                          className="flex items-center gap-2 text-sm"
                          key={workspace}
                        >
                          <input
                            type="checkbox"
                            checked={activeWorkspaces.includes(workspace)}
                            onChange={(event) => {
                              setSelectedWorkspaces((current) => {
                                const next =
                                  current ?? workspacesQuery.currentData ?? [];
                                return event.target.checked
                                  ? [...next, workspace]
                                  : next.filter((value) => value !== workspace);
                              });
                            }}
                          />
                          {formatLabel(workspace)}
                        </label>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        workspaceState.isLoading || selectedWorkspaces === null
                      }
                      onClick={() => void saveWorkspaces()}
                    >
                      Save workspaces
                    </Button>
                  </>
                )}
                {workspaceState.error ? (
                  <ErrorAlert
                    error={workspaceState.error}
                    fallback="Unable to update workspaces."
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {permissions.canTransition &&
          transitionOptions[contract.status].length ? (
            <div className="space-y-3 border-t pt-5">
              <div>
                <h3 className="text-sm font-semibold">Change status</h3>
                <p className="text-sm text-muted-foreground">
                  Every status change requires a reason and is recorded in
                  history.
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="contract-transition-reason">
                  Reason
                </FieldLabel>
                <Textarea
                  id="contract-transition-reason"
                  value={reason}
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  required
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {transitionOptions[contract.status].map(
                  ({ transition: action, label }) => (
                    <form
                      key={action}
                      onSubmit={(event) => void transition(event, action)}
                    >
                      <input type="hidden" name="reason" value={reason} />
                      <Button
                        type="submit"
                        disabled={transitionState.isLoading || !reason.trim()}
                      >
                        {label}
                      </Button>
                    </form>
                  ),
                )}
              </div>
              {transitionState.error ? (
                <ErrorAlert
                  error={transitionState.error}
                  fallback="Unable to change contract status."
                />
              ) : null}
            </div>
          ) : null}

          {permissions.canManage ? (
            <div className="border-t pt-5">
              <Button
                type="button"
                variant="destructive"
                disabled={archiveState.isLoading}
                onClick={async () => {
                  if (
                    window.confirm(
                      "Archive this contract? Access and pending invitations will be revoked.",
                    )
                  ) {
                    const result = await archiveContract(query);
                    if (!("error" in result)) {
                      router.push(
                        `/dashboards/contracts?companyId=${encodeURIComponent(companyId)}`,
                      );
                    }
                  }
                }}
              >
                Archive contract
              </Button>
              {archiveState.error ? (
                <div className="mt-3">
                  <ErrorAlert
                    error={archiveState.error}
                    fallback="Unable to archive the contract."
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {permissions.canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a company</CardTitle>
            <CardDescription>
              Invite an active, verified company to join this contract.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
              <Field className="min-w-64 flex-1">
                <FieldLabel htmlFor="party-invitation-email">
                  Company email
                </FieldLabel>
                <Input
                  id="party-invitation-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="party-invitation-type">
                  Party type
                </FieldLabel>
                <NativeSelect
                  id="party-invitation-type"
                  value={inviteType}
                  onChange={(event) =>
                    setInviteType(event.target.value as EPartyType)
                  }
                >
                  <NativeSelectOption value={EPartyType.CONTRACTOR}>
                    Contractor
                  </NativeSelectOption>
                  <NativeSelectOption value={EPartyType.SUBCONTRACTOR}>
                    Subcontractor
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Button type="submit" disabled={invitationState.isLoading}>
                Send invitation
              </Button>
            </form>
            {invitationState.error ? (
              <ErrorAlert
                error={invitationState.error}
                fallback="Unable to send the company invitation."
              />
            ) : null}
            {revokeInvitationState.error ? (
              <ErrorAlert
                error={revokeInvitationState.error}
                fallback="Unable to revoke the company invitation."
              />
            ) : null}
            {invitationsQuery.error ? (
              <ErrorAlert
                error={invitationsQuery.error}
                fallback="Unable to load contract invitations."
              />
            ) : invitationsQuery.currentData?.length ? (
              <ul className="divide-y">
                {invitationsQuery.currentData.map((invitation) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    key={invitation.id}
                  >
                    <span>
                      {invitation.email} · {formatLabel(invitation.partyType)}
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge variant="outline">
                        {formatLabel(invitation.status)}
                      </Badge>
                      {invitation.status === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            void revokeInvitation({
                              ...query,
                              invitationId: invitation.id,
                            })
                          }
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No company invitations have been sent.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function FormInput({
  name,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
}) {
  const id = `new-contract-${name}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} {...props} />
    </Field>
  );
}

function FormSelect({
  name,
  label,
  values,
  defaultValue,
}: {
  name: string;
  label: string;
  values: string[];
  defaultValue?: string;
}) {
  const id = `new-contract-${name}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        name={name}
        defaultValue={defaultValue ?? values[0]}
      >
        {values.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {formatLabel(value)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function ErrorAlert({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{getApiErrorMessage(error, fallback)}</AlertDescription>
    </Alert>
  );
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
