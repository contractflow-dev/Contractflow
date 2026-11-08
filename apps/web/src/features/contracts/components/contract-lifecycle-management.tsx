"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ECompanyRole,
  EContractSortField,
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
  ESortOrder,
  MAX_PAGE_LIMIT,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  FormField,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import {
  StatusBadge,
  effectiveInvitationStatus,
} from "@/components/status-badge/status-badge";
import { getApiErrorMessage } from "@/lib/apiError";
import { humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { useGetCompanyMembershipQuery } from "@/services/companiesApi";
import {
  useArchiveContractMutation,
  useCreateContractMutation,
  useCreateContractPartyInvitationMutation,
  useGetContractLifecyclePermissionsQuery,
  useGetContractPartyInvitationsQuery,
  useGetContractsQuery,
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
import {
  ContractSetupFields,
  contractWorkspaces as workspaces,
  validateContractDates,
  type ContractDateErrors,
} from "./contract-setup-fields";

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

const transitionEffects: Record<
  ContractTransition,
  { effect: string; done: string; destructive: boolean }
> = {
  activate: {
    effect: "will move from Draft to Active.",
    done: "Contract activated.",
    destructive: false,
  },
  hold: {
    effect: "will be suspended until someone resumes it.",
    done: "Contract suspended.",
    destructive: true,
  },
  resume: {
    effect: "will move from Suspended back to Active.",
    done: "Contract resumed.",
    destructive: false,
  },
  complete: {
    effect:
      "will be marked as completed. A completed contract can't change status again.",
    done: "Contract completed.",
    destructive: true,
  },
};

export function CreateContractForm({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [dateErrors, setDateErrors] = useState<ContractDateErrors>({});
  const formId = useId();
  const membershipQuery = useGetCompanyMembershipQuery({ companyId });
  const parentContractsQuery = useGetContractsQuery(
    {
      companyId,
      page: 1,
      limit: MAX_PAGE_LIMIT,
      sortBy: EContractSortField.REFERENCE_NUMBER,
      sortOrder: ESortOrder.ASC,
    },
    { skip: !open },
  );
  const [createContract, createState] = useCreateContractMutation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const errors = validateContractDates({
      awardDate: String(form.get("awardDate") ?? ""),
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      revisedEndDate: String(form.get("revisedEndDate") ?? ""),
      actualCompletionDate: String(form.get("actualCompletionDate") ?? ""),
    });
    setDateErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      formElement
        .querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        ?.focus();
      return;
    }
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
      parentContractId: String(form.get("parentContractId") ?? "") || null,
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
    notifySuccess(
      "Draft contract created",
      `${body.referenceNumber} · ${body.title} is ready to set up.`,
    );
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
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle>Contract setup</CardTitle>
          <CardDescription>
            Create a draft contract for this company.
          </CardDescription>
        </div>
        <Button
          type="button"
          aria-expanded={open}
          aria-controls={open ? formId : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "New contract"}
        </Button>
      </CardHeader>
      {open ? (
        <CardContent>
          <form
            id={formId}
            aria-label="New draft contract"
            onSubmit={submit}
            onChange={(event) => {
              // Editing a date clears the error shown for it.
              const target = event.target;
              if (!(target instanceof HTMLInputElement)) return;
              const name = target.name as keyof ContractDateErrors;
              if (dateErrors[name]) {
                setDateErrors((current) => {
                  const next = { ...current };
                  delete next[name];
                  return next;
                });
              }
            }}
            className="space-y-6"
          >
            <RequiredFieldsNote />
            <ContractSetupFields
              parentContracts={parentContractsQuery.currentData?.data ?? []}
              parentContractsLoading={parentContractsQuery.isFetching}
              parentContractsError={parentContractsQuery.error}
              dateErrors={dateErrors}
            />
            {createState.error ? (
              <ErrorAlert
                error={createState.error}
                fallback="Unable to create the contract."
              />
            ) : null}
            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateErrors({});
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createState.isLoading}
                aria-busy={createState.isLoading || undefined}
              >
                {createState.isLoading ? "Creating…" : "Create draft contract"}
              </Button>
            </div>
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
  const [pendingTransition, setPendingTransition] = useState<{
    transition: ContractTransition;
    label: string;
  } | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [archiveRequested, setArchiveRequested] = useState(false);
  // The failure of the confirmation currently open, shown inside it.
  const [dialogError, setDialogError] = useState("");
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
    const result = await updateContract({
      ...query,
      body: { title: title.trim(), description: description.trim() || null },
    });
    if (!("error" in result)) notifySuccess("Contract details saved");
  }

  async function saveWorkspaces() {
    const result = await updateWorkspaces({
      ...query,
      workspaces: activeWorkspaces,
    });
    if (!("error" in result)) {
      setSelectedWorkspaces(null);
      notifySuccess("Workspaces updated");
    }
  }

  function requestTransition(
    event: FormEvent<HTMLFormElement>,
    option: { transition: ContractTransition; label: string },
  ) {
    event.preventDefault();
    if (!reason.trim()) return;
    setDialogError("");
    setPendingTransition(option);
  }

  async function confirmTransition() {
    if (!pendingTransition || transitionState.isLoading) return;
    const result = await transitionContract({
      ...query,
      transition: pendingTransition.transition,
      reason: reason.trim(),
    });
    if ("error" in result) {
      setDialogError(
        getApiErrorMessage(result.error, "Unable to change contract status."),
      );
      return;
    }
    setReason("");
    notifySuccess(transitionEffects[pendingTransition.transition].done);
    setPendingTransition(null);
  }

  async function confirmInvitationRevocation() {
    if (!invitationToRevoke || revokeInvitationState.isLoading) return;
    const result = await revokeInvitation({
      ...query,
      invitationId: invitationToRevoke.id,
    });
    if ("error" in result) {
      setDialogError(
        getApiErrorMessage(
          result.error,
          "Unable to revoke the company invitation.",
        ),
      );
      return;
    }
    notifySuccess(
      "Invitation revoked",
      `The invitation for ${invitationToRevoke.email} no longer works.`,
    );
    setInvitationToRevoke(null);
  }

  async function confirmArchive() {
    if (archiveState.isLoading) return;
    const result = await archiveContract(query);
    if ("error" in result) {
      setDialogError(
        getApiErrorMessage(result.error, "Unable to archive the contract."),
      );
      return;
    }
    setArchiveRequested(false);
    notifySuccess(
      "Contract archived",
      `${contract.referenceNumber} · ${contract.title} was archived. You can restore it from the contract register.`,
    );
    router.push("/dashboards/contracts");
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await createInvitation({
      ...query,
      email: inviteEmail.trim(),
      partyType: inviteType,
    });
    if (!("error" in result)) {
      notifySuccess(
        "Company invitation sent",
        `${inviteEmail.trim()} can now accept the invitation to this contract.`,
      );
      setInviteEmail("");
    }
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
                aria-label="Contract details"
                className="grid items-start gap-4 sm:grid-cols-2"
              >
                <FormField id="contract-title" label="Contract title" required>
                  {(control) => (
                    <Input
                      {...control}
                      value={title}
                      maxLength={255}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                    />
                  )}
                </FormField>
                <FormField
                  id="contract-description"
                  label="Description"
                  optional
                >
                  {(control) => (
                    <Textarea
                      {...control}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  )}
                </FormField>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={updateState.isLoading}
                    aria-busy={updateState.isLoading || undefined}
                  >
                    {updateState.isLoading ? "Saving…" : "Save details"}
                  </Button>
                </div>
              </form>
              {updateState.error ? (
                <ErrorAlert
                  error={updateState.error}
                  fallback="Unable to update contract details."
                />
              ) : null}

              <FormSection
                legend="Available workspaces"
                description="Removing a workspace revokes its active assignments and pending invitations."
                className="border-t pt-5"
              >
                {workspacesQuery.error ? (
                  <ErrorAlert
                    error={workspacesQuery.error}
                    fallback="Unable to load contract workspaces."
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {workspaces.map((workspace) => (
                        <label
                          className="flex min-h-6 items-center gap-2 text-sm"
                          key={workspace}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
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
                      className="w-fit"
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
              </FormSection>
            </>
          ) : null}

          {permissions.canTransition &&
          transitionOptions[contract.status].length ? (
            <div className="space-y-3 border-t pt-5">
              <div>
                <h3 className="type-subsection-title">Change status</h3>
                <p className="text-sm text-muted-foreground">
                  Every status change requires a reason and is recorded in
                  history.
                </p>
              </div>
              <FormField
                id="contract-transition-reason"
                label="Reason for the change"
                required
                description="Up to 2,000 characters. The status buttons are available once a reason is entered."
              >
                {(control) => (
                  <Textarea
                    {...control}
                    value={reason}
                    maxLength={2000}
                    onChange={(event) => setReason(event.target.value)}
                    required
                  />
                )}
              </FormField>
              <div className="flex flex-wrap gap-2">
                {transitionOptions[contract.status].map((option) => (
                  <form
                    key={option.transition}
                    onSubmit={(event) => requestTransition(event, option)}
                  >
                    <input type="hidden" name="reason" value={reason} />
                    <Button
                      type="submit"
                      disabled={transitionState.isLoading || !reason.trim()}
                    >
                      {option.label}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}

          {permissions.canManage ? (
            <div className="space-y-3 border-t pt-5">
              <div>
                <h3 className="type-subsection-title">Archive contract</h3>
                <p className="text-sm text-muted-foreground">
                  Archiving removes the contract from the register and revokes
                  access and pending invitations.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                disabled={archiveState.isLoading}
                onClick={() => {
                  setDialogError("");
                  setArchiveRequested(true);
                }}
              >
                Archive contract
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {permissions.canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a company</CardTitle>
            <CardDescription>
              Invite an active, verified company to join this contract, using
              the email address on its company profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={invite}
              aria-label="Invite a company"
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
            >
              <FormField id="party-invitation-email" label="Company email">
                {(control) => (
                  <Input
                    {...control}
                    type="email"
                    autoComplete="off"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                  />
                )}
              </FormField>
              <FormField id="party-invitation-type" label="Party type">
                {(control) => (
                  <NativeSelect
                    {...control}
                    className="w-full"
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
                )}
              </FormField>
              <Button
                type="submit"
                disabled={invitationState.isLoading}
                aria-busy={invitationState.isLoading || undefined}
              >
                {invitationState.isLoading ? "Sending…" : "Send invitation"}
              </Button>
            </form>
            {invitationState.error ? (
              <ErrorAlert
                error={invitationState.error}
                fallback="Unable to send the company invitation."
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
                      <StatusBadge
                        status={effectiveInvitationStatus(
                          invitation.status,
                          invitation.expiresAt,
                        )}
                      />
                      {effectiveInvitationStatus(
                        invitation.status,
                        invitation.expiresAt,
                      ) === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revokeInvitationState.isLoading}
                          onClick={() => {
                            setDialogError("");
                            setInvitationToRevoke({
                              id: invitation.id,
                              email: invitation.email,
                            });
                          }}
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

      <ConfirmDialog
        open={pendingTransition !== null}
        title={
          pendingTransition
            ? `${pendingTransition.label} this contract?`
            : "Change contract status?"
        }
        description={
          pendingTransition
            ? `${contract.referenceNumber} · ${contract.title} ${transitionEffects[pendingTransition.transition].effect} The reason below is recorded in the status history.`
            : ""
        }
        confirmLabel={pendingTransition?.label ?? "Confirm"}
        pendingLabel="Changing status…"
        isPending={transitionState.isLoading}
        error={pendingTransition ? dialogError : undefined}
        destructive={
          pendingTransition
            ? transitionEffects[pendingTransition.transition].destructive
            : false
        }
        onConfirm={() => void confirmTransition()}
        onCancel={() => setPendingTransition(null)}
      >
        <blockquote className="max-h-32 overflow-y-auto border-s-2 ps-3 text-sm break-words whitespace-pre-wrap text-muted-foreground">
          {reason.trim()}
        </blockquote>
      </ConfirmDialog>

      <ConfirmDialog
        open={invitationToRevoke !== null}
        title="Revoke this company invitation?"
        description={
          invitationToRevoke
            ? `The invitation sent to ${invitationToRevoke.email} will stop working, and that company won't be able to join this contract with it.`
            : ""
        }
        confirmLabel="Revoke invitation"
        pendingLabel="Revoking…"
        isPending={revokeInvitationState.isLoading}
        error={invitationToRevoke ? dialogError : undefined}
        destructive
        onConfirm={() => void confirmInvitationRevocation()}
        onCancel={() => setInvitationToRevoke(null)}
      />

      <ConfirmDialog
        open={archiveRequested}
        title="Archive this contract?"
        description={`${contract.referenceNumber} · ${contract.title} will be removed from the contract register. All contract role assignments and pending invitations are revoked. A Company Administrator can restore the contract from the register, but access must then be granted again.`}
        confirmLabel="Archive contract"
        pendingLabel="Archiving…"
        isPending={archiveState.isLoading}
        error={archiveRequested ? dialogError : undefined}
        destructive
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiveRequested(false)}
      />
    </section>
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

const formatLabel = humanizeEnumValue;
