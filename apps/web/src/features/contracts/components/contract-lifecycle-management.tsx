"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  EContractStatus,
  EPartyType,
  type ContractActivityTarget,
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
import { ArchiveContractDialog } from "./contract-archive";
import { FormField } from "@/components/forms/form-field";
import {
  StatusBadge,
  effectiveInvitationStatus,
} from "@/components/status-badge/status-badge";
import { getApiErrorMessage } from "@/lib/apiError";
import { humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useCreateContractPartyInvitationMutation,
  useGetContractLifecyclePermissionsQuery,
  useGetContractPartyInvitationsQuery,
  useRevokeContractPartyInvitationMutation,
  useTransitionContractMutation,
  useUpdateContractMutation,
  type Contract,
  type ContractTransition,
} from "@/services/contractApi";

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

export function ContractLifecycleManagement({
  companyId,
  contract,
  part,
  target,
}: {
  companyId: string;
  contract: Contract;
  /**
   * Which card to show: managing the contract itself (Overview tab), or
   * inviting companies to it (Parties tab). Both share this state and dialogs.
   */
  part: "manage" | "invitations";
  target?: ContractActivityTarget | null;
}) {
  const query = { companyId, contractId: contract.id };
  const permissionsQuery = useGetContractLifecyclePermissionsQuery(query);
  const permissions = permissionsQuery.data;
  const invitationsQuery = useGetContractPartyInvitationsQuery(query, {
    skip: !permissions?.canManage,
  });
  const [updateContract, updateState] = useUpdateContractMutation();
  const [transitionContract, transitionState] = useTransitionContractMutation();
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
      {part === "manage" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Manage contract</h2>
            </CardTitle>
            <CardDescription>
              Draft details and lifecycle actions. Workspaces are managed in
              Contract workspaces.
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
                  <FormField
                    id="contract-title"
                    label="Contract title"
                    required
                  >
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
      ) : null}

      {part === "invitations" && permissions.canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Invite a company</h2>
            </CardTitle>
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
                    id={`activity-target-${invitation.id}`}
                    className={`flex flex-wrap items-center justify-between gap-3 py-3 text-sm ${
                      target?.type === "contract_party_invitation" &&
                      target.id === invitation.id
                        ? "bg-primary/10"
                        : ""
                    }`}
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

      {archiveRequested ? (
        <ArchiveContractDialog
          companyId={companyId}
          contract={contract}
          onCancel={() => setArchiveRequested(false)}
          onArchived={() => {
            setArchiveRequested(false);
            router.push("/dashboards/contracts");
          }}
        />
      ) : null}
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

const formatLabel = humanizeEnumValue;
