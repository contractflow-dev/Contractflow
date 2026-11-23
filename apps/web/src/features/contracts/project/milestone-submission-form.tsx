"use client";

import { useState, type FormEvent } from "react";
import { RiLockLine, RiUploadLine } from "@remixicon/react";
import {
  EDocumentCategory,
  EDocumentVisibility,
  type DocumentSummary,
  type Milestone,
  type MilestoneOutstandingItem,
} from "@contractflow/contracts-schema";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
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
import { useSubmitMilestoneMutation } from "@/services/deliveryApi";
import { useGetContractDocumentsQuery } from "@/services/documentsApi";
import { useDocumentUpload } from "../_hooks/use-document-upload";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_TYPES_LABEL,
  documentFileProblem,
} from "../document-files";
import { Prose, type ProjectContext } from "./project-ui";

/**
 * Documents the API accepts as evidence: uploaded by the submitter's company
 * to this contract, shared with all parties, of a category the Project
 * workspace can open, with a finished upload (MilestoneWorkflowService).
 */
export const EVIDENCE_CATEGORIES: readonly EDocumentCategory[] = [
  EDocumentCategory.REPORT,
  EDocumentCategory.CERTIFICATE,
  EDocumentCategory.CONTRACT,
  EDocumentCategory.OTHER,
];
export const MAX_EVIDENCE = 20;

export function isEligibleEvidence(
  document: DocumentSummary,
  companyId: string,
): boolean {
  return (
    document.ownerCompanyId === companyId &&
    document.visibility === EDocumentVisibility.PUBLIC &&
    EVIDENCE_CATEGORIES.includes(document.category) &&
    document.currentVersion !== null
  );
}

/**
 * The Contractor Project Lead's submission. After a partial approval it
 * covers exactly the open outstanding items, all of them (the API refuses
 * anything else), and the accepted work is shown as settled. Otherwise it
 * covers the whole milestone.
 */
export function MilestoneSubmissionForm({
  project,
  milestone,
  openItems,
  onBusyChange,
  onDone,
}: {
  project: ProjectContext;
  milestone: Milestone;
  openItems: readonly MilestoneOutstandingItem[];
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const { companyId, contractId } = project;
  const outstandingOnly = openItems.length > 0;
  const documents = useGetContractDocumentsQuery({
    companyId,
    contractId,
    page: 1,
    limit: 100,
  });
  const eligible = (documents.currentData?.data ?? []).filter((document) =>
    isEligibleEvidence(document, companyId),
  );
  const [submit, state] = useSubmitMilestoneMutation();
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const selectedIds = Object.keys(selected);

  function toggle(documentId: string, on: boolean) {
    setSelected((current) => {
      const next = { ...current };
      if (on) next[documentId] = next[documentId] ?? "";
      else delete next[documentId];
      return next;
    });
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!notes.trim()) next.notes = "Describe the work you are submitting.";
    if (progress.trim() && parsePercentToBasisPoints(progress) === null) {
      next.progress =
        "Enter a share between 0 and 100, with up to two decimals.";
    }
    if (!selectedIds.length)
      next.evidence = "Attach at least one evidence file.";
    if (selectedIds.length > MAX_EVIDENCE) {
      next.evidence = `Attach at most ${MAX_EVIDENCE} files.`;
    }
    setErrors(next);
    if (!Object.keys(next).length) setReviewing(true);
  }

  async function send() {
    onBusyChange(true);
    const result = await submit({
      companyId,
      contractId,
      milestoneId: milestone.id,
      body: {
        notes: notes.trim(),
        reportedProgressBps: progress.trim()
          ? parsePercentToBasisPoints(progress)
          : null,
        evidence: selectedIds.map((documentId) => ({
          documentId,
          caption: selected[documentId]?.trim() || null,
        })),
        ...(outstandingOnly
          ? { outstandingItemIds: openItems.map(({ id }) => id) }
          : {}),
      },
    });
    onBusyChange(false);
    if (!("error" in result)) {
      setReviewing(false);
      notifySuccess(
        outstandingOnly ? "Outstanding work submitted" : "Milestone submitted",
        `${milestone.title} is waiting for the Client Project Manager's review.`,
      );
      onDone();
    }
  }

  const submitError = state.error
    ? getApiErrorMessage(state.error, "The submission couldn't be sent.")
    : null;
  const id = `submit-${milestone.id}`;
  return (
    <>
      <form
        onSubmit={review}
        noValidate
        className="flex min-h-full flex-col"
        aria-label={`Submit ${milestone.title}`}
      >
        <SheetHeader className="border-b">
          <SheetTitle>
            {outstandingOnly ? "Submit outstanding work" : "Submit for review"}
          </SheetTitle>
          <SheetDescription>
            {milestone.title}. The Client Project Manager reviews it against the
            acceptance criteria.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 p-4">
          <RequiredFieldsNote />

          <FormSection legend="What is being checked">
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
                <dt className="text-xs text-muted-foreground">Deliverables</dt>
                <dd>
                  <Prose text={milestone.deliverables} />
                </dd>
              </div>
            </dl>
          </FormSection>

          {outstandingOnly ? (
            <FormSection
              legend="This submission covers"
              description="After a partial approval, only the outstanding work is submitted, all of it together. Work already accepted stays accepted and is not resubmitted."
            >
              <p className="flex items-center gap-2 rounded-xl border bg-success-soft p-3 text-sm text-success-soft-foreground">
                <RiLockLine aria-hidden="true" className="size-4 shrink-0" />
                {formatBasisPoints(milestone.approvedBps)} of this milestone is
                already accepted.
              </p>
              <ul className="space-y-2" aria-label="Outstanding items covered">
                {openItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border p-3 text-sm"
                  >
                    <Checkbox
                      checked
                      disabled
                      aria-label={`Covers: ${item.description}`}
                    />
                    <span className="whitespace-pre-line">
                      {item.description}
                      {item.quantity != null
                        ? ` (${formatNumber(item.quantity)}${milestone.quantityUnit ? ` ${milestone.quantityUnit}` : ""})`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </FormSection>
          ) : null}

          <FormSection legend="Completion">
            <FormGrid columns={1}>
              <FormField
                id={`${id}-notes`}
                label="Completion notes"
                required
                error={errors.notes}
                description="What was done, and how it meets the acceptance criteria."
              >
                {(control) => (
                  <Textarea
                    {...control}
                    value={notes}
                    maxLength={5000}
                    rows={5}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                )}
              </FormField>
              <FormField
                id={`${id}-progress`}
                label="Your measure of completion (%)"
                optional
                error={errors.progress}
                description="Only the client's decision decides what is accepted."
              >
                {(control) => (
                  <Input
                    {...control}
                    value={progress}
                    inputMode="decimal"
                    onChange={(event) => setProgress(event.target.value)}
                  />
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            legend="Evidence"
            description="Contract documents your company uploaded and shared with all parties: reports, certificates, contract or other documents. Each file is kept at its current version."
          >
            {documents.isLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading your documents…
              </p>
            ) : documents.error ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {getApiErrorMessage(
                    documents.error,
                    "Your documents couldn't be loaded.",
                  )}
                </AlertDescription>
              </Alert>
            ) : eligible.length ? (
              <ul className="space-y-2" aria-label="Documents you can attach">
                {eligible.map((document) => {
                  const on = document.id in selected;
                  const checkbox = `${id}-doc-${document.id}`;
                  return (
                    <li
                      key={document.id}
                      className="space-y-2 rounded-xl border p-3"
                    >
                      <label
                        htmlFor={checkbox}
                        className="flex items-start gap-3 text-sm"
                      >
                        <Checkbox
                          id={checkbox}
                          checked={on}
                          onCheckedChange={(checked) =>
                            toggle(document.id, checked === true)
                          }
                        />
                        <span className="min-w-0">
                          <span className="block font-medium break-words">
                            {document.title}
                          </span>
                          <span className="block text-xs break-words text-muted-foreground">
                            {DOCUMENT_CATEGORY_LABELS[document.category]} ·{" "}
                            {document.currentVersion?.fileName}
                          </span>
                        </span>
                      </label>
                      {on ? (
                        <FormField
                          id={`${checkbox}-caption`}
                          label="Caption"
                          optional
                        >
                          {(control) => (
                            <Input
                              {...control}
                              value={selected[document.id]}
                              maxLength={255}
                              onChange={(event) =>
                                setSelected((current) => ({
                                  ...current,
                                  [document.id]: event.target.value,
                                }))
                              }
                            />
                          )}
                        </FormField>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                None of your company&apos;s documents on this contract can be
                attached yet. Upload one below.
              </p>
            )}
            {errors.evidence ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.evidence}
              </p>
            ) : null}
            <EvidenceUpload
              project={project}
              onBusyChange={onBusyChange}
              onUploaded={(documentId) => toggle(documentId, true)}
            />
          </FormSection>
        </div>
        <SheetFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t bg-popover">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit">Review submission</Button>
        </SheetFooter>
      </form>

      <ConfirmDialog
        open={reviewing}
        title={`Submit ${milestone.title} for review?`}
        description={
          outstandingOnly
            ? `This covers the ${openItems.length} outstanding item${openItems.length === 1 ? "" : "s"} only. The work already accepted is not affected.`
            : "The Client Project Manager will review the whole milestone. Its scope is fixed once it is submitted."
        }
        confirmLabel="Submit"
        pendingLabel="Submitting…"
        isPending={state.isLoading}
        error={submitError}
        onConfirm={() => void send()}
        onCancel={() => setReviewing(false)}
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Evidence</dt>
            <dd>
              {selectedIds.length} file{selectedIds.length === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Your measure</dt>
            <dd>
              {progress.trim()
                ? formatBasisPoints(parsePercentToBasisPoints(progress))
                : "Not given"}
            </dd>
          </div>
        </dl>
      </ConfirmDialog>
    </>
  );
}

/**
 * A new evidence document, uploaded shared with all parties (the API accepts
 * only shared evidence) and then attached.
 */
function EvidenceUpload({
  project,
  onBusyChange,
  onUploaded,
}: {
  project: ProjectContext;
  onBusyChange: (busy: boolean) => void;
  onUploaded: (documentId: string) => void;
}) {
  const { upload, step, label, error } = useDocumentUpload({
    companyId: project.companyId,
    contractId: project.contractId,
  });
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EDocumentCategory>(
    EDocumentCategory.REPORT,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const busy = step !== null;

  async function start() {
    const issue = !file
      ? "Choose a file to upload."
      : (documentFileProblem(file) ??
        (!title.trim() ? "Enter a title." : null));
    setProblem(issue);
    if (issue || !file) return;
    onBusyChange(true);
    const document = await upload(file, {
      kind: "new",
      meta: {
        title: title.trim(),
        documentNumber: "",
        category,
        visibility: EDocumentVisibility.PUBLIC,
      },
      changeNote: "",
    });
    onBusyChange(false);
    if (document) {
      notifySuccess("Evidence uploaded", document.title);
      onUploaded(document.id);
      setOpen(false);
      setFile(null);
      setTitle("");
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <RiUploadLine aria-hidden="true" data-icon="inline-start" />
        Upload a new file
      </Button>
    );
  }
  const id = "evidence-upload";
  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      role="group"
      aria-label="Upload evidence"
    >
      <p className="text-xs text-muted-foreground">
        {DOCUMENT_TYPES_LABEL} files up to 25 MB. It is added to the
        contract&apos;s documents, shared with all parties.
      </p>
      <FormGrid columns={2}>
        <FormField id={`${id}-title`} label="Title" required>
          {(control) => (
            <Input
              {...control}
              value={title}
              maxLength={255}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </FormField>
        <FormField id={`${id}-category`} label="Category" required>
          {(control) => (
            <NativeSelect
              {...control}
              className="w-full"
              value={category}
              disabled={busy}
              onChange={(event) =>
                setCategory(event.target.value as EDocumentCategory)
              }
            >
              {EVIDENCE_CATEGORIES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {DOCUMENT_CATEGORY_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </FormGrid>
      <FormField id={`${id}-file`} label="File" required>
        {(control) => (
          <Input
            {...control}
            type="file"
            accept={DOCUMENT_ACCEPT}
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        )}
      </FormField>
      {problem || error ? (
        <p role="alert" className="text-sm text-destructive">
          {problem ?? error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {label ?? "Upload and attach"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel upload
        </Button>
        {label ? (
          <span role="status" className="sr-only">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
