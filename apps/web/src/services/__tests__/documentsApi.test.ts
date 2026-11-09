import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDocumentCategory,
  EDocumentVisibility,
} from "@contractflow/contracts-schema";
import { store } from "@/store";
import { setActiveWorkspaceId } from "@/features/workspace/workspaceSlice";
import { api } from "@/services/api";
import { documentsApi } from "@/services/documentsApi";

const COMPANY = "01J00000000000000000000CMP";
const CONTRACT = "01J00000000000000000000CTR";
const DOCUMENT = "01J00000000000000000000DOC";

describe("RTK Query document API contracts", () => {
  const fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

  beforeEach(() => {
    store.dispatch(api.util.resetApiState());
    store.dispatch(setActiveWorkspaceId(COMPANY));
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: [], meta: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const lastRequest = () => {
    const [input, init] = fetchMock.mock.calls.at(-1)!;
    return new Request(input, init);
  };
  const requestWith = (method: string) => {
    // Read the method without copying the request, which would use up its body.
    const call = fetchMock.mock.calls.findLast(
      ([input, init]) =>
        (init?.method ?? (input instanceof Request ? input.method : "GET")) ===
        method,
    )!;
    return new Request(call[0], call[1]);
  };

  it("lists documents with scope only in headers", async () => {
    await store.dispatch(
      documentsApi.endpoints.getContractDocuments.initiate({
        companyId: COMPANY,
        contractId: CONTRACT,
        page: 2,
        limit: 10,
      }),
    );

    const request = lastRequest();
    const url = new URL(request.url);
    expect(url.pathname).toMatch(/\/contract\/documents$/);
    expect(url.search).toBe("?page=2&limit=10");
    expect(request.headers.get("X-Company-Id")).toBe(COMPANY);
    expect(request.headers.get("X-Contract-Id")).toBe(CONTRACT);
    expect(request.url).not.toContain(COMPANY);
    expect(request.url).not.toContain(CONTRACT);
  });

  it("requests upload permission without scope identifiers in the body", async () => {
    await store.dispatch(
      documentsApi.endpoints.createDocumentUpload.initiate({
        companyId: COMPANY,
        contractId: CONTRACT,
        body: {
          title: "Method statement",
          category: EDocumentCategory.REPORT,
          visibility: EDocumentVisibility.PRIVATE,
          fileName: "method.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          checksumSha256: "a".repeat(64),
        },
      }),
    );

    const request = lastRequest();
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toMatch(
      /\/contract\/documents\/upload-url$/,
    );
    const body = await request.text();
    expect(body).not.toContain(COMPANY);
    expect(body).not.toContain(CONTRACT);
    expect(request.headers.get("X-Contract-Id")).toBe(CONTRACT);
  });

  it("confirms uploads and requests downloads for one document", async () => {
    await store.dispatch(
      documentsApi.endpoints.completeDocumentUpload.initiate({
        companyId: COMPANY,
        contractId: CONTRACT,
        documentId: DOCUMENT,
        versionId: "01J00000000000000000000VER",
      }),
    );
    expect(new URL(lastRequest().url).pathname).toMatch(
      new RegExp(
        `/contract/documents/${DOCUMENT}/versions/01J00000000000000000000VER/complete$`,
      ),
    );

    await store.dispatch(
      documentsApi.endpoints.createDocumentDownloadUrl.initiate({
        companyId: COMPANY,
        contractId: CONTRACT,
        documentId: DOCUMENT,
      }),
    );
    const download = lastRequest();
    expect(download.method).toBe("GET");
    expect(new URL(download.url).pathname).toMatch(
      new RegExp(`/contract/documents/${DOCUMENT}/download-url$`),
    );
    expect(new URL(download.url).search).toBe("");
  });

  it("uses company routes, with no contract header, for company documents", async () => {
    await store.dispatch(
      documentsApi.endpoints.getContractDocuments.initiate({
        companyId: COMPANY,
        page: 1,
        limit: 10,
      }),
    );
    let request = lastRequest();
    expect(new URL(request.url).pathname).toMatch(/\/company\/documents$/);
    expect(request.headers.get("X-Company-Id")).toBe(COMPANY);
    expect(request.headers.get("X-Contract-Id")).toBeNull();

    await store.dispatch(
      documentsApi.endpoints.createDocumentUpload.initiate({
        companyId: COMPANY,
        body: {
          title: "Insurance master policy",
          category: EDocumentCategory.CERTIFICATE,
          fileName: "policy.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          checksumSha256: "a".repeat(64),
        },
      }),
    );
    // The list refetches after the upload, so pick the upload itself.
    request = requestWith("POST");
    expect(new URL(request.url).pathname).toMatch(
      /\/company\/documents\/upload-url$/,
    );
    expect(request.headers.get("X-Contract-Id")).toBeNull();
    const body = await request.json();
    expect(body).not.toHaveProperty("visibility");
    expect(JSON.stringify(body)).not.toContain(COMPANY);

    await store.dispatch(
      documentsApi.endpoints.deleteContractDocument.initiate({
        companyId: COMPANY,
        documentId: DOCUMENT,
      }),
    );
    request = requestWith("DELETE");
    expect(new URL(request.url).pathname).toMatch(
      new RegExp(`/company/documents/${DOCUMENT}$`),
    );
  });
});
