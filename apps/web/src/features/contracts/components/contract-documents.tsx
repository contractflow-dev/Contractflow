"use client";

import { Fragment, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  EDocumentCategory,
  EDocumentUploadStatus,
  EDocumentVisibility,
} from "@contractflow/contracts-schema";
import { RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
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
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Textarea } from "@workspace/ui/components/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  FormField,
  FormGrid,
  RequiredFieldsNote,
} from "@/components/forms/form-field";
import { DataPagination } from "@/components/pagination/data-pagination";
import { StatusBadge } from "@/components/status-badge/status-badge";
import { useUserTimeZone } from "@/hooks/use-user-time-zone";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  PresignedUploadError,
  sha256Hex,
  uploadToPresignedUrl,
} from "@/lib/presignedUpload";
import type { Contract } from "@/services/contractApi";
import {
  useCompleteDocumentUploadMutation,
  useCreateDocumentDownloadUrlMutation,
  useCreateDocumentUploadMutation,
  useCreateDocumentVersionUploadMutation,
  useDeleteContractDocumentMutation,
  useGetContractDocumentQuery,
  useGetContractDocumentsQuery,
  type DocumentSummary,
  type DocumentUploadSession,
} from "@/services/documentsApi";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_TYPES_LABEL,
  DOCUMENT_VISIBILITY_LABELS,
  documentFileProblem,
  documentMimeType,
} from "../document-files";

const categories = Object.values(EDocumentCategory);
const visibilities = Object.values(EDocumentVisibility);

/** Shared parts of the new-document and new-version forms. */
const fileSchema = z
  .custom<File | null>((value) => value !== null && typeof value === "object", {
    message: "Choose a file to upload.",
  })
  .superRefine((file, context) => {
    const problem = file ? documentFileProblem(file) : null;
    if (problem) context.addIssue({ code: "custom", message: problem });
  });
const changeNoteSchema = z
  .string()
  .trim()
  .max(1000, "Keep the note under 1,000 characters.");

export const newDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title.")
    .max(255, "Keep the title under 255 characters."),
  documentNumber: z
    .string()
    .trim()
    .max(60, "Keep the document number under 60 characters."),
  category: z.enum(EDocumentCategory),
  visibility: z.enum(EDocumentVisibility),
  file: fileSchema,
  changeNote: changeNoteSchema,
});
export const newVersionSchema = z.object({
  file: fileSchema,
  changeNote: changeNoteSchema,
});

type NewDocumentValues = z.infer<typeof newDocumentSchema>;
type NewVersionValues = z.infer<typeof newVersionSchema>;
/** A contract's documents, or (without a contract) the company's own. */
type Scope = { companyId: string; contractId?: string };

/**
 * The contract's documents: files shared with every party, or kept to the
 * uploading company. The API decides what each user may see and do; a user
 * without a role on the contract is told so instead of seeing an error.
 * Documents of an archived contract stay readable but can't be changed.
 */
export function ContractDocuments({
  companyId,
  contract,
}: {
  companyId: string;
  contract: Contract;
}) {
  const archived = Boolean(contract.deletedAt);
  return (
    <DocumentLibrary
      scope={{ companyId, contractId: contract.id }}
      shared
      canAdd={!archived}
      canChange={!archived}
      description="Drawings, certificates, reports and other files for this contract. Earlier versions are kept when a file is replaced."
      emptyText={
        archived
          ? "This contract is archived, so no documents can be added."
          : `Upload the signed contract, drawings, certificates or reports. ${DOCUMENT_TYPES_LABEL} files up to 25 MB.`
      }
      noAccess={{
        title: "Documents are shared with the contract team",
        text: "Only people who hold a role on this contract can view and upload its documents. A Company Administrator can assign contract roles from the Roles section.",
      }}
    />
  );
}

/**
 * The company's own library, such as insurance policies and registration
 * certificates. It is private to the company: other companies never see it,
 * even on contracts they share. Members can read it; Company Administrators
 * add, replace and delete documents.
 */
export function CompanyDocuments({
  companyId,
  canManage,
}: {
  companyId: string;
  canManage: boolean;
}) {
  return (
    <DocumentLibrary
      scope={{ companyId }}
      shared={false}
      canAdd={canManage}
      canChange={canManage}
      description="Policies, certificates and other files that belong to your company rather than to one contract. Only your company's members can see them."
      emptyText={
        canManage
          ? `Upload insurance policies, registration certificates or company procedures. ${DOCUMENT_TYPES_LABEL} files up to 25 MB.`
          : "Your Company Administrators haven't added any company documents yet."
      }
      noAccess={{
        title: "Company documents aren't available",
        text: "Only active members of this company can view its documents.",
      }}
    />
  );
}

function DocumentLibrary({
  scope,
  shared,
  canAdd,
  canChange,
  description,
  emptyText,
  noAccess: noAccessCopy,
}: {
  scope: Scope;
  /** Contract documents choose who they're shared with; company ones don't. */
  shared: boolean;
  /** Offer uploads. The API still decides. */
  canAdd: boolean;
  /** Offer new versions and deletion of the company's own documents. */
  canChange: boolean;
  description: string;
  emptyText: string;
  noAccess: { title: string; text: string };
}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [form, setForm] = useState<
    { kind: "new" } | { kind: "version"; document: DocumentSummary } | null
  >(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null);
  const documents = useGetContractDocumentsQuery({ ...scope, page, limit });
  const noAccess = getApiErrorStatus(documents.error) === 403;
  const data = documents.currentData;
  const canUpload = canAdd && !noAccess && !documents.isLoading;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>
            <h2>Documents</h2>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {canUpload && form === null ? (
          <Button type="button" onClick={() => setForm({ kind: "new" })}>
            Upload document
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {form?.kind === "new" ? (
          <NewDocumentForm
            scope={scope}
            shared={shared}
            onDone={() => setForm(null)}
          />
        ) : form?.kind === "version" ? (
          <NewVersionForm
            key={form.document.id}
            scope={scope}
            document={form.document}
            onDone={() => setForm(null)}
          />
        ) : null}

        {documents.isLoading ? (
          <div
            role="status"
            aria-label="Loading documents"
            className="space-y-3"
          >
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
            <span className="sr-only">Loading documents…</span>
          </div>
        ) : noAccess ? (
          <div className="space-y-2 rounded-2xl border border-dashed p-6 text-center">
            <h3 className="font-semibold">{noAccessCopy.title}</h3>
            <p className="mx-auto max-w-prose text-sm leading-6 text-muted-foreground">
              {noAccessCopy.text}
            </p>
          </div>
        ) : documents.error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {getApiErrorMessage(
                  documents.error,
                  "Unable to load documents.",
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void documents.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : data?.data.length ? (
          <>
            <DocumentList
              scope={scope}
              documents={data.data}
              ownerCompanyId={scope.companyId}
              canChange={canChange}
              shared={shared}
              expanded={expanded}
              onToggle={(id) =>
                setExpanded((open) => (open === id ? null : id))
              }
              onNewVersion={(document) =>
                setForm({ kind: "version", document })
              }
              onDelete={setDeleting}
            />
            <DataPagination
              className="border-t pt-4"
              meta={data.meta}
              itemLabel="documents"
              isFetching={documents.isFetching}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setLimit(size);
                setPage(1);
              }}
            />
          </>
        ) : (
          <div className="space-y-2 rounded-2xl border border-dashed p-6 text-center">
            <h3 className="font-semibold">No documents yet</h3>
            <p className="mx-auto max-w-prose text-sm leading-6 text-muted-foreground">
              {emptyText}
            </p>
          </div>
        )}
      </CardContent>
      <DeleteDocumentDialog
        scope={scope}
        document={deleting}
        shared={shared}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => setExpanded((open) => (open === id ? null : open))}
      />
    </Card>
  );
}

function DocumentList({
  scope,
  documents,
  ownerCompanyId,
  canChange,
  shared,
  expanded,
  onToggle,
  onNewVersion,
  onDelete,
}: {
  scope: Scope;
  documents: DocumentSummary[];
  ownerCompanyId: string;
  canChange: boolean;
  shared: boolean;
  expanded: string | null;
  onToggle: (id: string) => void;
  onNewVersion: (document: DocumentSummary) => void;
  onDelete: (document: DocumentSummary) => void;
}) {
  const timeZone = useUserTimeZone();
  const actions = (document: DocumentSummary) => (
    <DocumentActions
      scope={scope}
      document={document}
      // Only the uploading company changes a document; the API enforces it.
      owned={document.ownerCompanyId === ownerCompanyId && canChange}
      expanded={expanded === document.id}
      onToggle={() => onToggle(document.id)}
      onNewVersion={() => onNewVersion(document)}
      onDelete={() => onDelete(document)}
    />
  );

  return (
    <>
      {/* Phones: one card per document. */}
      <ul className="divide-y rounded-2xl border md:hidden">
        {documents.map((document) => (
          <li key={document.id} className="space-y-3 p-4">
            <DocumentTitle document={document} />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Category</dt>
              <dd>{DOCUMENT_CATEGORY_LABELS[document.category]}</dd>
              {shared ? (
                <>
                  <dt className="text-muted-foreground">Shared with</dt>
                  <dd>{DOCUMENT_VISIBILITY_LABELS[document.visibility]}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">File</dt>
              <dd className="min-w-0">
                <CurrentVersion document={document} />
              </dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{formatDate(document.updatedAt, { timeZone })}</dd>
            </dl>
            {actions(document)}
            {expanded === document.id ? (
              <VersionHistory scope={scope} documentId={document.id} />
            ) : null}
          </li>
        ))}
      </ul>

      {/* From md: a table. */}
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Category</TableHead>
              {shared ? <TableHead>Shared with</TableHead> : null}
              <TableHead>Current file</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <Fragment key={document.id}>
                <TableRow>
                  <TableCell className="max-w-72 whitespace-normal">
                    <DocumentTitle document={document} />
                  </TableCell>
                  <TableCell>
                    {DOCUMENT_CATEGORY_LABELS[document.category]}
                  </TableCell>
                  {shared ? (
                    <TableCell>
                      {DOCUMENT_VISIBILITY_LABELS[document.visibility]}
                    </TableCell>
                  ) : null}
                  <TableCell className="max-w-64 whitespace-normal">
                    <CurrentVersion document={document} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(document.updatedAt, { timeZone })}
                  </TableCell>
                  <TableCell>{actions(document)}</TableCell>
                </TableRow>
                {expanded === document.id ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={shared ? 6 : 5}
                      className="bg-muted/30 whitespace-normal"
                    >
                      <VersionHistory scope={scope} documentId={document.id} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function DocumentTitle({ document }: { document: DocumentSummary }) {
  return (
    <div className="min-w-0">
      <p className="font-medium break-words">{document.title}</p>
      <p className="text-xs break-words text-muted-foreground">
        {document.documentNumber}
      </p>
    </div>
  );
}

function CurrentVersion({ document }: { document: DocumentSummary }) {
  const version = document.currentVersion;
  if (!version) {
    // No available version yet: the first upload is unfinished or failed.
    return <StatusBadge status={EDocumentUploadStatus.PENDING_UPLOAD} />;
  }
  return (
    <div className="min-w-0 text-sm">
      <p className="break-words">{version.fileName}</p>
      <p className="text-xs text-muted-foreground">
        Version {version.versionNumber} · {formatFileSize(version.sizeBytes)}
      </p>
    </div>
  );
}

function DocumentActions({
  scope,
  document,
  owned,
  expanded,
  onToggle,
  onNewVersion,
  onDelete,
}: {
  scope: Scope;
  document: DocumentSummary;
  owned: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNewVersion: () => void;
  onDelete: () => void;
}) {
  const download = useDownload(scope);
  const historyId = `document-${document.id}-versions`;
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
      {document.currentVersion ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={download.isLoading}
          aria-label={`Download ${document.title}`}
          onClick={() => void download.start(document.id)}
        >
          Download
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-expanded={expanded}
        aria-controls={expanded ? historyId : undefined}
        aria-label={`${expanded ? "Hide" : "Show"} versions of ${document.title}`}
        onClick={onToggle}
      >
        Versions
        {expanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
      </Button>
      {owned ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Upload a new version of ${document.title}`}
            onClick={onNewVersion}
          >
            New version
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            aria-label={`Delete ${document.title}`}
            onClick={onDelete}
          >
            Delete
          </Button>
        </>
      ) : null}
    </div>
  );
}

function VersionHistory({
  scope,
  documentId,
}: {
  scope: Scope;
  documentId: string;
}) {
  const timeZone = useUserTimeZone();
  const detail = useGetContractDocumentQuery({ ...scope, documentId });
  const download = useDownload(scope);
  const versions = [...(detail.currentData?.versions ?? [])].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );

  return (
    <section
      id={`document-${documentId}-versions`}
      aria-label="Version history"
      className="space-y-2"
    >
      <h3 className="type-subsection-title">Version history</h3>
      {detail.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading versions…
        </p>
      ) : detail.error ? (
        <p className="text-sm text-destructive">
          {getApiErrorMessage(detail.error, "Unable to load the versions.")}
        </p>
      ) : versions.length ? (
        <ol className="space-y-2">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">
                  Version {version.versionNumber} · {version.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(version.sizeBytes)} ·{" "}
                  {formatDateTime(version.uploadedAt, { timeZone })}
                  {version.changeNote ? ` · ${version.changeNote}` : ""}
                </p>
              </div>
              {version.uploadStatus === EDocumentUploadStatus.AVAILABLE ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={download.isLoading}
                  aria-label={`Download version ${version.versionNumber}`}
                  onClick={() => void download.start(documentId, version.id)}
                >
                  Download
                </Button>
              ) : (
                <StatusBadge status={version.uploadStatus} />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No versions yet.</p>
      )}
    </section>
  );
}

/** Asks for a short-lived link and lets the browser save the file. */
function useDownload(scope: Scope) {
  const [createUrl, state] = useCreateDocumentDownloadUrlMutation();
  return {
    isLoading: state.isLoading,
    async start(documentId: string, versionId?: string) {
      try {
        const { url } = await createUrl({
          ...scope,
          documentId,
          versionId,
        }).unwrap();
        // The link is signed as an attachment, so the page stays put. It is
        // a bearer credential and is not stored anywhere.
        window.location.assign(url);
      } catch (error) {
        notifyError(
          error,
          "The file couldn't be downloaded.",
          "Download failed",
        );
      }
    },
  };
}

type UploadStep = "hashing" | "uploading" | "finishing";
const STEP_LABEL: Record<Exclude<UploadStep, "uploading">, string> = {
  hashing: "Preparing file…",
  finishing: "Checking file…",
};

/**
 * Uploads in three steps: ask the API for a presigned PUT (sending the
 * file's SHA-256, which storage checks), send the bytes straight to storage,
 * then ask the API to verify and publish the version.
 */
function useDocumentUpload(scope: Scope) {
  const [createUpload] = useCreateDocumentUploadMutation();
  const [createVersion] = useCreateDocumentVersionUploadMutation();
  const [complete] = useCompleteDocumentUploadMutation();
  const [step, setStep] = useState<UploadStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function upload(
    file: File,
    request:
      | {
          kind: "new";
          meta: Omit<NewDocumentValues, "file" | "changeNote">;
          changeNote: string;
        }
      | { kind: "version"; documentId: string; changeNote: string },
  ): Promise<boolean> {
    setError(null);
    try {
      setStep("hashing");
      const fileRequest = {
        fileName: file.name,
        mimeType: documentMimeType(file),
        sizeBytes: file.size,
        checksumSha256: await sha256Hex(file),
        ...(request.changeNote ? { changeNote: request.changeNote } : {}),
      };
      let session: DocumentUploadSession;
      if (request.kind === "new") {
        const { documentNumber, visibility, ...meta } = request.meta;
        session = await createUpload({
          ...scope,
          body: {
            ...meta,
            // Company documents are always private; the API sets that.
            ...(scope.contractId ? { visibility } : {}),
            ...(documentNumber ? { documentNumber } : {}),
            ...fileRequest,
          },
        }).unwrap();
      } else {
        session = await createVersion({
          ...scope,
          documentId: request.documentId,
          body: fileRequest,
        }).unwrap();
      }

      setStep("uploading");
      setProgress(0);
      await uploadToPresignedUrl(session.upload, file, {
        onProgress: setProgress,
      });

      setStep("finishing");
      await complete({
        ...scope,
        documentId: session.document.id,
        versionId: session.version.id,
      }).unwrap();
      return true;
    } catch (caught) {
      setError(
        caught instanceof PresignedUploadError
          ? caught.message
          : getApiErrorMessage(caught, "The document couldn't be uploaded."),
      );
      return false;
    } finally {
      setStep(null);
    }
  }

  const label =
    step === "uploading"
      ? `Uploading… ${Math.round(progress * 100)}%`
      : step
        ? STEP_LABEL[step]
        : null;
  return { upload, step, label, error };
}

function NewDocumentForm({
  scope,
  shared,
  onDone,
}: {
  scope: Scope;
  shared: boolean;
  onDone: () => void;
}) {
  const { upload, step, label, error } = useDocumentUpload(scope);
  const methods = useForm<NewDocumentValues>({
    resolver: zodResolver(newDocumentSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      title: "",
      documentNumber: "",
      category: EDocumentCategory.CONTRACT,
      visibility: EDocumentVisibility.PUBLIC,
      file: null,
      changeNote: "",
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  async function onSubmit({ file, changeNote, ...meta }: NewDocumentValues) {
    if (!file) return;
    if (await upload(file, { kind: "new", meta, changeNote })) {
      notifySuccess("Document uploaded", meta.title);
      onDone();
    }
  }

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        aria-label="Upload a document"
        className="space-y-5 rounded-2xl border p-4 sm:p-5"
      >
        <div className="space-y-1">
          <h3 className="type-subsection-title">Upload a document</h3>
          <RequiredFieldsNote />
        </div>
        <FormGrid columns={2}>
          <FormField
            id="document-title"
            label="Title"
            required
            error={errors.title?.message}
          >
            {(c) => <Input {...c} maxLength={255} {...register("title")} />}
          </FormField>
          <FormField
            id="document-number"
            label="Document number"
            optional
            description="Leave blank to number it automatically."
            error={errors.documentNumber?.message}
          >
            {(c) => (
              <Input
                {...c}
                maxLength={60}
                autoComplete="off"
                {...register("documentNumber")}
              />
            )}
          </FormField>
          <FormField
            id="document-category"
            label="Category"
            required
            description={
              shared
                ? "HSE and invoice documents need an HSE or Finance role on this contract."
                : undefined
            }
            error={errors.category?.message}
          >
            {(c) => (
              <NativeSelect {...c} className="w-full" {...register("category")}>
                {categories.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {DOCUMENT_CATEGORY_LABELS[category]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {shared ? (
            <FormField
              id="document-visibility"
              label="Shared with"
              required
              error={errors.visibility?.message}
            >
              {(c) => (
                <NativeSelect
                  {...c}
                  className="w-full"
                  {...register("visibility")}
                >
                  {visibilities.map((visibility) => (
                    <NativeSelectOption key={visibility} value={visibility}>
                      {DOCUMENT_VISIBILITY_LABELS[visibility]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          ) : null}
        </FormGrid>
        <FileFields idPrefix="document" />
        <UploadFooter
          step={step}
          label={label}
          error={error}
          submitLabel="Upload document"
          onCancel={onDone}
        />
      </form>
    </FormProvider>
  );
}

function NewVersionForm({
  scope,
  document,
  onDone,
}: {
  scope: Scope;
  document: DocumentSummary;
  onDone: () => void;
}) {
  const { upload, step, label, error } = useDocumentUpload(scope);
  const methods = useForm<NewVersionValues>({
    resolver: zodResolver(newVersionSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { file: null, changeNote: "" },
  });

  async function onSubmit({ file, changeNote }: NewVersionValues) {
    if (!file) return;
    if (
      await upload(file, {
        kind: "version",
        documentId: document.id,
        changeNote,
      })
    ) {
      notifySuccess("New version uploaded", document.title);
      onDone();
    }
  }

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        onSubmit={methods.handleSubmit(onSubmit)}
        aria-label={`Upload a new version of ${document.title}`}
        className="space-y-5 rounded-2xl border p-4 sm:p-5"
      >
        <div className="space-y-1">
          <h3 className="type-subsection-title break-words">
            New version of {document.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            The current file stays in the version history.
          </p>
        </div>
        <FileFields idPrefix="version" />
        <UploadFooter
          step={step}
          label={label}
          error={error}
          submitLabel="Upload new version"
          onCancel={onDone}
        />
      </form>
    </FormProvider>
  );
}

/**
 * The file picker and change note, shared by both forms. Both forms' values
 * include `file` and `changeNote`, which is all this reads.
 */
function FileFields({ idPrefix }: { idPrefix: string }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<NewVersionValues>();
  return (
    <FormGrid columns={2}>
      <FormField
        id={`${idPrefix}-file`}
        label="File"
        required
        description={`${DOCUMENT_TYPES_LABEL}. Up to 25 MB.`}
        error={errors.file?.message}
      >
        {(c) => (
          <Controller
            control={control}
            name="file"
            render={({ field }) => (
              <Input
                {...c}
                ref={field.ref}
                name={field.name}
                type="file"
                accept={DOCUMENT_ACCEPT}
                onBlur={field.onBlur}
                onChange={(event) =>
                  field.onChange(event.target.files?.[0] ?? null)
                }
                className="py-1.5 file:me-3"
              />
            )}
          />
        )}
      </FormField>
      <FormField
        id={`${idPrefix}-note`}
        label="Note about this version"
        optional
        error={errors.changeNote?.message}
      >
        {(c) => (
          <Textarea
            {...c}
            rows={2}
            maxLength={1000}
            {...register("changeNote")}
          />
        )}
      </FormField>
    </FormGrid>
  );
}

function UploadFooter({
  step,
  label,
  error,
  submitLabel,
  onCancel,
}: {
  step: UploadStep | null;
  /** What the upload is doing now, shown on the button while it runs. */
  label: string | null;
  error: string | null;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={step !== null}
          aria-busy={step !== null || undefined}
        >
          {label ?? submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={step !== null}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </>
  );
}

function DeleteDocumentDialog({
  scope,
  document,
  shared,
  onClose,
  onDeleted,
}: {
  scope: Scope;
  document: DocumentSummary | null;
  shared: boolean;
  onClose: () => void;
  onDeleted: (documentId: string) => void;
}) {
  const [remove, state] = useDeleteContractDocumentMutation();
  return (
    <ConfirmDialog
      open={document !== null}
      title="Delete this document?"
      description={
        document
          ? shared
            ? `“${document.title}” and all of its versions will be removed from this contract for every party.`
            : `“${document.title}” and all of its versions will be removed from your company's documents.`
          : ""
      }
      error={
        state.error
          ? getApiErrorMessage(state.error, "The document couldn't be deleted.")
          : undefined
      }
      confirmLabel="Delete document"
      pendingLabel="Deleting…"
      isPending={state.isLoading}
      destructive
      onCancel={() => {
        state.reset();
        onClose();
      }}
      onConfirm={() => {
        if (!document) return;
        void remove({ ...scope, documentId: document.id })
          .unwrap()
          .then(() => {
            onDeleted(document.id);
            notifySuccess("Document deleted", document.title);
            state.reset();
            onClose();
          })
          .catch(() => {
            // Shown in the dialog through `state.error`.
          });
      }}
    />
  );
}
