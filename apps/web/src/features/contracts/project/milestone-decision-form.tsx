"use client";

import { useState, type FormEvent } from "react";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";
import {
  EMilestoneDecisionType,
  EMilestoneSubmissionType,
  type DecideMilestoneSubmissionRequest,
  type Milestone,
  type MilestoneOutstandingItem,
  type MilestoneSubmission,
} from "@contractflow/contracts-schema";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { Textarea } from "@workspace/ui/components/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  formatBasisPoints,
  formatNumber,
  parsePercentToBasisPoints,
} from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { useDecideMilestoneSubmissionMutation } from "@/services/deliveryApi";
import { EvidenceList } from "./milestone-history";
import {
  DECISION_LABEL,
  FULL_BPS,
  SUBMISSION_TYPE_LABEL,
  shareForQuantity,
} from "./project-rules";
import { Prose, type ProjectContext } from "./project-ui";

interface ItemDraft {
  key: number;
  description: string;
  quantity: string;
}

const WHOLE = /^[1-9]\d{0,9}$/;

/**
 * The Client Project Manager's decision on the latest submission: approve
 * it, reject it with a reason, or approve part of it. A partial approval of
 * the whole milestone lists the work still outstanding; a partial approval of
 * outstanding work accepts some of the items it covers. The request follows
 * DecideMilestoneSubmissionRequest; the API validates it again.
 */
export function MilestoneDecisionForm({
  project,
  milestone,
  submission,
  openItems,
  onBusyChange,
  onDone,
}: {
  project: ProjectContext;
  milestone: Milestone;
  submission: MilestoneSubmission;
  openItems: readonly MilestoneOutstandingItem[];
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [decide, state] = useDecideMilestoneSubmissionMutation();
  const [decision, setDecision] = useState<EMilestoneDecisionType>(
    EMilestoneDecisionType.APPROVED,
  );
  const [reason, setReason] = useState("");
  const [approvedWork, setApprovedWork] = useState("");
  const [share, setShare] = useState("");
  const [quantity, setQuantity] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    { key: 1, description: "", quantity: "" },
  ]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const coversItems =
    submission.submissionType === EMilestoneSubmissionType.OUTSTANDING_WORK;
  const covered = openItems.filter((item) =>
    submission.addressedItemIds.includes(item.id),
  );
  const target = milestone.targetQuantity;
  const remainingBps = FULL_BPS - milestone.approvedBps;
  const remainingQuantity =
    target === null ? null : target - (milestone.approvedQuantity ?? 0);
  const unit = milestone.quantityUnit ? ` ${milestone.quantityUnit}` : "";

  // With a target, the accepted share follows the quantity, as the API requires.
  const acceptedQuantity =
    target === null
      ? null
      : coversItems
        ? covered
            .filter((item) => accepted.includes(item.id))
            .reduce((sum, item) => sum + (item.quantity ?? 0), 0)
        : WHOLE.test(quantity.trim())
          ? Number(quantity.trim())
          : null;
  const approvedBps =
    target !== null
      ? acceptedQuantity
        ? shareForQuantity({
            targetQuantity: target,
            approvedQuantity: milestone.approvedQuantity,
            approvedBps: milestone.approvedBps,
            quantity: acceptedQuantity,
          })
        : null
      : parsePercentToBasisPoints(share);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (decision === EMilestoneDecisionType.REJECTED && !reason.trim()) {
      next.reason = "A rejection needs a reason.";
    }
    if (decision !== EMilestoneDecisionType.PARTIALLY_APPROVED) return next;
    if (!reason.trim()) next.reason = "A partial approval needs a reason.";
    if (!approvedWork.trim()) {
      next.approvedWork = "Describe the work this decision accepts.";
    }
    if (coversItems) {
      if (!accepted.length || accepted.length >= covered.length) {
        next.accepted =
          "Choose the items this decision accepts: at least one, and not all (accepting all is an approval).";
      }
    } else {
      const filled = items.filter((item) => item.description.trim());
      if (!filled.length)
        next.items = "List the work that is still outstanding.";
      if (target !== null) {
        if (acceptedQuantity === null) {
          next.quantity = "Give the quantity accepted, a whole number above 0.";
        }
        if (filled.some((item) => !WHOLE.test(item.quantity.trim()))) {
          next.items = "Give each outstanding item its quantity.";
        } else if (acceptedQuantity !== null && remainingQuantity !== null) {
          const outstanding = filled.reduce(
            (sum, item) => sum + Number(item.quantity.trim()),
            0,
          );
          if (acceptedQuantity + outstanding !== remainingQuantity) {
            next.items = `Accepted (${acceptedQuantity}) and outstanding (${outstanding}) must add up to the ${remainingQuantity}${unit} not yet accepted.`;
          }
        }
      } else if (
        filled.some(
          (item) => item.quantity.trim() && !WHOLE.test(item.quantity.trim()),
        )
      ) {
        next.items = "An item quantity must be a whole number above 0.";
      }
    }
    if (
      !next.quantity &&
      !next.accepted &&
      (approvedBps === null || approvedBps <= 0 || approvedBps >= remainingBps)
    ) {
      next.share = `A partial approval accepts more than 0% and less than the ${formatBasisPoints(remainingBps)} not yet accepted.`;
    }
    return next;
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (!Object.keys(next).length) setConfirming(true);
  }

  function request(): DecideMilestoneSubmissionRequest {
    const note = reason.trim() || null;
    if (decision === EMilestoneDecisionType.APPROVED) {
      return { decision, reason: note };
    }
    if (decision === EMilestoneDecisionType.REJECTED) {
      return { decision, reason: note };
    }
    return {
      decision,
      reason: note,
      approvedWork: approvedWork.trim(),
      approvedBps,
      ...(target !== null ? { approvedQuantity: acceptedQuantity } : {}),
      ...(coversItems
        ? { acceptedItemIds: accepted }
        : {
            outstandingItems: items
              .filter((item) => item.description.trim())
              .map((item) => ({
                description: item.description.trim(),
                quantity: item.quantity.trim()
                  ? Number(item.quantity.trim())
                  : null,
              })),
          }),
    };
  }

  async function send() {
    onBusyChange(true);
    const result = await decide({
      companyId: project.companyId,
      contractId: project.contractId,
      milestoneId: milestone.id,
      submissionId: submission.id,
      body: request(),
    });
    onBusyChange(false);
    if (!("error" in result)) {
      setConfirming(false);
      notifySuccess(
        `Submission ${DECISION_LABEL[decision].toLowerCase()}`,
        milestone.title,
      );
      onDone();
    }
  }

  const id = `decide-${submission.id}`;
  return (
    <>
      <form
        onSubmit={review}
        noValidate
        className="flex min-h-full flex-col"
        aria-label={`Review ${milestone.title}`}
      >
        <SheetHeader className="border-b">
          <SheetTitle>Review submission {submission.sequence}</SheetTitle>
          <SheetDescription>
            {milestone.title} ·{" "}
            {SUBMISSION_TYPE_LABEL[submission.submissionType]}.{" "}
            {formatBasisPoints(milestone.approvedBps)} accepted so far.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 p-4">
          <FormSection legend="What was submitted">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Acceptance criteria
                </dt>
                <dd>
                  <Prose text={milestone.acceptanceCriteria} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Completion notes
                </dt>
                <dd className="whitespace-pre-line">{submission.notes}</dd>
              </div>
              {submission.reportedProgressBps != null ? (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Contractor&apos;s measure
                  </dt>
                  <dd>{formatBasisPoints(submission.reportedProgressBps)}</dd>
                </div>
              ) : null}
              {covered.length ? (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Outstanding items covered
                  </dt>
                  <dd>
                    <ul className="list-disc ps-5">
                      {covered.map((item) => (
                        <li key={item.id}>
                          {item.description}
                          {item.quantity != null
                            ? ` (${formatNumber(item.quantity)}${unit})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
            <EvidenceList project={project} evidence={submission.evidence} />
          </FormSection>

          <FormSection legend="Decision">
            <RadioGroup
              aria-label="Decision"
              value={decision}
              onValueChange={(value) =>
                setDecision(value as EMilestoneDecisionType)
              }
            >
              {(
                [
                  [
                    EMilestoneDecisionType.APPROVED,
                    coversItems
                      ? "Accepts every outstanding item it covers. The milestone is complete."
                      : "Accepts everything submitted. The milestone is complete.",
                  ],
                  [
                    EMilestoneDecisionType.PARTIALLY_APPROVED,
                    coversItems
                      ? "Accepts some of the items; the rest stay outstanding."
                      : "Accepts part of the work and lists what is outstanding. The contractor then submits only the outstanding work.",
                  ],
                  [
                    EMilestoneDecisionType.REJECTED,
                    "Accepts nothing. The contractor corrects and resubmits.",
                  ],
                ] as const
              ).map(([value, text]) => (
                <label
                  key={value}
                  htmlFor={`${id}-${value}`}
                  className="flex items-start gap-3 rounded-xl border p-3 text-sm has-data-checked:border-primary/50 has-data-checked:bg-accent"
                >
                  <RadioGroupItem id={`${id}-${value}`} value={value} />
                  <span>
                    <span className="block font-medium">
                      {value === EMilestoneDecisionType.APPROVED
                        ? "Approve"
                        : value === EMilestoneDecisionType.REJECTED
                          ? "Reject"
                          : "Approve in part"}
                    </span>
                    <span className="block text-muted-foreground">{text}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </FormSection>

          {decision === EMilestoneDecisionType.PARTIALLY_APPROVED ? (
            <FormSection legend="What is accepted">
              <RequiredFieldsNote />
              <FormField
                id={`${id}-approved-work`}
                label="Approved work"
                required
                error={errors.approvedWork}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    value={approvedWork}
                    maxLength={5000}
                    rows={3}
                    onChange={(event) => setApprovedWork(event.target.value)}
                  />
                )}
              </FormField>
              {coversItems ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    Items this decision accepts
                  </legend>
                  {covered.map((item) => (
                    <label
                      key={item.id}
                      htmlFor={`${id}-accept-${item.id}`}
                      className="flex items-start gap-3 rounded-xl border p-3 text-sm"
                    >
                      <Checkbox
                        id={`${id}-accept-${item.id}`}
                        checked={accepted.includes(item.id)}
                        onCheckedChange={(checked) =>
                          setAccepted((current) =>
                            checked === true
                              ? [...current, item.id]
                              : current.filter((other) => other !== item.id),
                          )
                        }
                      />
                      <span>
                        {item.description}
                        {item.quantity != null
                          ? ` (${formatNumber(item.quantity)}${unit})`
                          : ""}
                      </span>
                    </label>
                  ))}
                  {errors.accepted ? (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.accepted}
                    </p>
                  ) : null}
                </fieldset>
              ) : target !== null ? (
                <FormField
                  id={`${id}-quantity`}
                  label={`Quantity accepted (of ${formatNumber(remainingQuantity)}${unit} remaining)`}
                  required
                  error={errors.quantity}
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={quantity}
                      inputMode="numeric"
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  )}
                </FormField>
              ) : null}
              {target === null ? (
                <FormField
                  id={`${id}-share`}
                  label="Share of the whole milestone accepted by this decision (%)"
                  required
                  error={errors.share}
                  description={`More than 0% and less than the ${formatBasisPoints(remainingBps)} not yet accepted.`}
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={share}
                      inputMode="decimal"
                      onChange={(event) => setShare(event.target.value)}
                    />
                  )}
                </FormField>
              ) : (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {approvedBps !== null
                    ? `This accepts ${formatBasisPoints(approvedBps)} of the milestone, following the quantity.`
                    : "The share accepted follows the quantity."}
                  {errors.share ? (
                    <span role="alert" className="block text-destructive">
                      {errors.share}
                    </span>
                  ) : null}
                </p>
              )}
            </FormSection>
          ) : null}

          {decision === EMilestoneDecisionType.PARTIALLY_APPROVED &&
          !coversItems ? (
            <FormSection
              legend="Outstanding work"
              description="Each item the contractor must still complete. Their next submission covers only these."
            >
              <ul className="space-y-3">
                {items.map((item, index) => (
                  <li
                    key={item.key}
                    className="space-y-2 rounded-xl border p-3"
                  >
                    <FormGrid columns={2}>
                      <FormField
                        id={`${id}-item-${item.key}`}
                        label={`Item ${index + 1}`}
                        required
                      >
                        {(control) => (
                          <Input
                            {...control}
                            value={item.description}
                            maxLength={2000}
                            onChange={(event) =>
                              setItems((current) =>
                                current.map((other) =>
                                  other.key === item.key
                                    ? {
                                        ...other,
                                        description: event.target.value,
                                      }
                                    : other,
                                ),
                              )
                            }
                          />
                        )}
                      </FormField>
                      <FormField
                        id={`${id}-item-${item.key}-quantity`}
                        label={`Quantity${unit}`}
                        required={target !== null}
                        optional={target === null}
                      >
                        {(control) => (
                          <Input
                            {...control}
                            value={item.quantity}
                            inputMode="numeric"
                            onChange={(event) =>
                              setItems((current) =>
                                current.map((other) =>
                                  other.key === item.key
                                    ? { ...other, quantity: event.target.value }
                                    : other,
                                ),
                              )
                            }
                          />
                        )}
                      </FormField>
                    </FormGrid>
                    {items.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setItems((current) =>
                            current.filter((other) => other.key !== item.key),
                          )
                        }
                      >
                        <RiDeleteBinLine
                          aria-hidden="true"
                          data-icon="inline-start"
                        />
                        Remove item {index + 1}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {errors.items ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.items}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    {
                      key: Math.max(0, ...current.map(({ key }) => key)) + 1,
                      description: "",
                      quantity: "",
                    },
                  ])
                }
              >
                <RiAddLine aria-hidden="true" data-icon="inline-start" />
                Add an item
              </Button>
            </FormSection>
          ) : null}

          <FormField
            id={`${id}-reason`}
            label={
              decision === EMilestoneDecisionType.APPROVED ? "Note" : "Reason"
            }
            required={decision !== EMilestoneDecisionType.APPROVED}
            optional={decision === EMilestoneDecisionType.APPROVED}
            error={errors.reason}
            description={
              decision === EMilestoneDecisionType.REJECTED
                ? "The contractor sees it with the milestone."
                : undefined
            }
          >
            {(control) => (
              <Textarea
                {...control}
                value={reason}
                maxLength={2000}
                rows={3}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>
        </div>
        <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t bg-popover">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit">Review decision</Button>
        </SheetFooter>
      </form>

      <ConfirmDialog
        open={confirming}
        title={`${
          decision === EMilestoneDecisionType.APPROVED
            ? "Approve"
            : decision === EMilestoneDecisionType.REJECTED
              ? "Reject"
              : "Approve in part"
        } submission ${submission.sequence} of ${milestone.title}?`}
        description="A decision is final: it can't be changed or withdrawn, and it is recorded in the milestone's history."
        confirmLabel={`Confirm: ${DECISION_LABEL[decision].toLowerCase()}`}
        pendingLabel="Saving decision…"
        isPending={state.isLoading}
        destructive={decision === EMilestoneDecisionType.REJECTED}
        error={
          state.error
            ? getApiErrorMessage(state.error, "The decision couldn't be saved.")
            : null
        }
        onConfirm={() => void send()}
        onCancel={() => setConfirming(false)}
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Accepted now</dt>
            <dd>
              {decision === EMilestoneDecisionType.APPROVED
                ? formatBasisPoints(remainingBps)
                : decision === EMilestoneDecisionType.REJECTED
                  ? "Nothing"
                  : formatBasisPoints(approvedBps)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Milestone after</dt>
            <dd>
              {decision === EMilestoneDecisionType.APPROVED
                ? "100% approved"
                : decision === EMilestoneDecisionType.REJECTED
                  ? `${formatBasisPoints(milestone.approvedBps)} approved`
                  : `${formatBasisPoints(milestone.approvedBps + (approvedBps ?? 0))} approved`}
            </dd>
          </div>
          {decision === EMilestoneDecisionType.PARTIALLY_APPROVED &&
          !coversItems ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                Left outstanding
              </dt>
              <dd>
                {items.filter((item) => item.description.trim()).length} item(s)
              </dd>
            </div>
          ) : null}
        </dl>
      </ConfirmDialog>
    </>
  );
}
