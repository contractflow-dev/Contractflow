"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RiMailSendLine } from "@remixicon/react";
import {
  EContractStatus,
  type ContractActivityTarget,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Textarea } from "@workspace/ui/components/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { ListCard } from "@/components/data-table/list-card";
import { ArchiveContractDialog } from "./contract-archive";
import { InviteCompanyDialog } from "./invite-company-dialog";
import { contractEditHref } from "../contract-sections";
import { FormField } from "@/components/forms/form-field";
import {
  StatusBadge,
  effectiveInvitationStatus,
} from "@/components/status-badge/status-badge";
import { getApiErrorMessage } from "@/lib/apiError";
import { humanizeEnumValue } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import {
  useGetContractLifecyclePermissionsQuery,
  useGetContractPartyInvitationsQuery,
  useRevokeContractPartyInvitationMutation,
  useTransitionContractMutation,
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
    {
      transition: "practical_completion",
      label: "Record practical completion",
    },
    { transition: "complete", label: "Complete" },
  ],
  [EContractStatus.SUSPENDED]: [{ transition: "resume", label: "Resume" }],
  [EContractStatus.DEFECTS_LIABILITY]: [
    { transition: "complete", label: "Complete" },
  ],
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
  practical_completion: {
    effect:
      "will move into its defects liability period: only the post-contract obligations stage can still be worked on.",
    done: "Practical completion recorded.",
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
  // Who sends party invitations is its own permission: on a subcontract it
  // is the main contractor's Contractor Project Lead, not an administrator.
  const invitationsQuery = useGetContractPartyInvitationsQuery(query, {
    skip: !permissions?.canInviteParties,
  });
  const [transitionContract, transitionState] = useTransitionContractMutation();
  const [revokeInvitation, revokeInvitationState] =
    useRevokeContractPartyInvitationMutation();
  const router = useRouter();
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
  const [invitingCompany, setInvitingCompany] = useState(false);

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
  if (
    !permissions ||
    (!permissions.canManage &&
      !permissions.canTransition &&
      !permissions.canInviteParties)
  ) {
    return null;
  }
  const subcontract = permissions.invitesSubcontractors;

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

  return (
    <section className="space-y-5" aria-label="Contract lifecycle management">
      {part === "manage" &&
      (permissions.canManage || permissions.canTransition) ? (
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
            {permissions.canManage && !contract.deletedAt ? (
              // The contract's details are edited on their own page, in the
              // same steps as creating one.
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-prose text-sm text-muted-foreground">
                  Change the title, type, commercial terms and dates.
                </p>
                <Link
                  href={contractEditHref(contract.id)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Edit contract
                </Link>
              </div>
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

      {part === "invitations" && permissions.canInviteParties ? (
        <ListCard
          title={
            subcontract ? "Subcontractor invitations" : "Company invitations"
          }
          description={
            subcontract
              ? "Subcontractors invited to this subcontract and where each invitation stands."
              : "Companies invited to join this contract and where each invitation stands."
          }
          action={
            contract.deletedAt ? null : (
              <Button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setInvitingCompany(true)}
              >
                <RiMailSendLine aria-hidden="true" data-icon="inline-start" />
                {subcontract ? "Invite Subcontractor" : "Invite Company"}
              </Button>
            )
          }
        >
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
        </ListCard>
      ) : null}

      {part === "invitations" && permissions.canInviteParties ? (
        <InviteCompanyDialog
          companyId={companyId}
          contract={contract}
          subcontract={subcontract}
          open={invitingCompany}
          onOpenChange={setInvitingCompany}
        />
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
