"use client";

import { useState } from "react";
import type {
  EDocumentCategory,
  EDocumentVisibility,
} from "@contractflow/contracts-schema";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  PresignedUploadError,
  sha256Hex,
  uploadToPresignedUrl,
} from "@/lib/presignedUpload";
import {
  useCompleteDocumentUploadMutation,
  useCreateDocumentUploadMutation,
  useCreateDocumentVersionUploadMutation,
  type DocumentDetail,
  type DocumentUploadSession,
} from "@/services/documentsApi";
import { documentMimeType } from "../document-files";

/** A contract's documents, or (without a contract) the company's own. */
export type DocumentUploadScope = { companyId: string; contractId?: string };

/** What a new document records besides its file. */
export interface NewDocumentMeta {
  title: string;
  documentNumber: string;
  category: EDocumentCategory;
  visibility: EDocumentVisibility;
}

export type UploadStep = "hashing" | "uploading" | "finishing";
const STEP_LABEL: Record<Exclude<UploadStep, "uploading">, string> = {
  hashing: "Preparing file…",
  finishing: "Checking file…",
};

/**
 * Uploads in three steps: ask the API for a presigned PUT (sending the
 * file's SHA-256, which storage checks), send the bytes straight to storage,
 * then ask the API to verify and publish the version. Resolves to the
 * published document, or null when the upload failed (`error` says why).
 */
export function useDocumentUpload(scope: DocumentUploadScope) {
  const [createUpload] = useCreateDocumentUploadMutation();
  const [createVersion] = useCreateDocumentVersionUploadMutation();
  const [complete] = useCompleteDocumentUploadMutation();
  const [step, setStep] = useState<UploadStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function upload(
    file: File,
    request:
      | { kind: "new"; meta: NewDocumentMeta; changeNote: string }
      | { kind: "version"; documentId: string; changeNote: string },
  ): Promise<DocumentDetail | null> {
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
      return await complete({
        ...scope,
        documentId: session.document.id,
        versionId: session.version.id,
      }).unwrap();
    } catch (caught) {
      setError(
        caught instanceof PresignedUploadError
          ? caught.message
          : getApiErrorMessage(caught, "The document couldn't be uploaded."),
      );
      return null;
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
