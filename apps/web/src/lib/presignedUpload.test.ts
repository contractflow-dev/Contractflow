import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PresignedUploadError,
  sha256Hex,
  uploadToPresignedUrl,
} from "./presignedUpload";

class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  status = 0;
  withCredentials = true;
  headers: Record<string, string> = {};
  body: unknown;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
}

const instruction = {
  url: "https://bucket.s3.eu-north-1.amazonaws.com/key?X-Amz-Signature=sig",
  method: "PUT" as const,
  headers: {
    "Content-Type": "application/pdf",
    "x-amz-checksum-sha256": "checksum",
  },
  expiresAt: "2026-11-06T00:05:00.000Z",
};

describe("presigned uploads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hashes files as lower-case hex SHA-256", async () => {
    await expect(sha256Hex(new Blob([]))).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("sends exactly the signed method and headers without credentials", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const file = new Blob(["%PDF-"]);
    const progress = vi.fn();

    const upload = uploadToPresignedUrl(instruction, file, {
      onProgress: progress,
    });
    const request = FakeXhr.last;
    request.upload.onprogress?.({
      lengthComputable: true,
      loaded: 1,
      total: 2,
    } as ProgressEvent);
    request.status = 200;
    request.onload?.();
    await upload;

    expect(request.method).toBe("PUT");
    expect(request.url).toBe(instruction.url);
    expect(request.withCredentials).toBe(false);
    expect(request.headers).toEqual(instruction.headers);
    expect(request.body).toBe(file);
    expect(progress.mock.calls).toEqual([[0.5], [1]]);
  });

  it("reports a rejected or expired upload", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);

    const upload = uploadToPresignedUrl(instruction, new Blob(["x"]));
    FakeXhr.last.status = 403;
    FakeXhr.last.onload?.();

    await expect(upload).rejects.toEqual(
      new PresignedUploadError(
        "The upload link expired or was rejected. Please try again.",
        403,
      ),
    );
  });

  it("cancels through an abort signal", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const controller = new AbortController();

    const upload = uploadToPresignedUrl(instruction, new Blob(["x"]), {
      signal: controller.signal,
    });
    controller.abort();

    await expect(upload).rejects.toThrow("cancelled");
  });
});
