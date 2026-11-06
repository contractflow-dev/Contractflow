import type { DocumentUploadInstruction } from "@contractflow/contracts-schema";

/** Lower-case hex SHA-256, as the upload-permission request expects. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export interface PresignedUploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export class PresignedUploadError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "PresignedUploadError";
  }
}

/**
 * Sends the file straight to object storage. Only the signed headers are
 * sent: no cookies, API credentials or company headers go to storage, and the
 * URL (a temporary credential) is never logged.
 */
export function uploadToPresignedUrl(
  instruction: DocumentUploadInstruction,
  file: Blob,
  options: PresignedUploadOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new PresignedUploadError("The upload was cancelled.", null));
      return;
    }
    const request = new XMLHttpRequest();
    request.open(instruction.method, instruction.url);
    request.withCredentials = false;
    for (const [name, value] of Object.entries(instruction.headers)) {
      request.setRequestHeader(name, value);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded / event.total);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(1);
        resolve();
      } else {
        reject(
          new PresignedUploadError(
            request.status === 403
              ? "The upload link expired or was rejected. Please try again."
              : "The file could not be uploaded. Please try again.",
            request.status,
          ),
        );
      }
    };
    request.onerror = () =>
      reject(
        new PresignedUploadError(
          "The file could not be uploaded. Check your connection and try again.",
          null,
        ),
      );
    request.onabort = () =>
      reject(new PresignedUploadError("The upload was cancelled.", null));
    options.signal?.addEventListener("abort", () => request.abort(), {
      once: true,
    });

    request.send(file);
  });
}
