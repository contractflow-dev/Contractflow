import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractStatus,
  EContractType,
  EDocumentCategory,
  EDocumentStatus,
  EDocumentUploadStatus,
  EDocumentVisibility,
} from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import type { DocumentSummary } from "@/services/documentsApi";
import {
  CompanyDocuments,
  ContractDocuments,
  newDocumentSchema,
  newVersionSchema,
} from "./contract-documents";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/services/documentsApi", () => ({
  useGetContractDocumentsQuery: mocks.list,
  useGetContractDocumentQuery: () => ({ isLoading: true }),
  useCreateDocumentUploadMutation: () => [vi.fn()],
  useCreateDocumentVersionUploadMutation: () => [vi.fn()],
  useCompleteDocumentUploadMutation: () => [vi.fn()],
  useCreateDocumentDownloadUrlMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteContractDocumentMutation: () => [
    vi.fn(),
    { isLoading: false, reset: vi.fn() },
  ],
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));

const contract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Pipeline integrity",
  contractType: Object.values(EContractType)[0],
  status: EContractStatus.ACTIVE,
  deletedAt: null,
} as Contract;

const version = {
  id: "version-1",
  versionNumber: 3,
  fileName: "Hydrotest procedure rev C.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2_516_582,
  checksumSha256: "a".repeat(64),
  changeNote: "",
  uploadStatus: EDocumentUploadStatus.AVAILABLE,
  uploadedById: "member-1",
  uploadedAt: "2026-11-08T10:00:00.000Z",
};

function document(overrides: Partial<DocumentSummary>): DocumentSummary {
  return {
    id: "doc-1",
    contractId: "contract-1",
    ownerCompanyId: "company-1",
    title: "Hydrotest procedure",
    documentNumber: "HT-PRO-014",
    category: EDocumentCategory.CONTRACT,
    visibility: EDocumentVisibility.PUBLIC,
    status: EDocumentStatus.VALID,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-08T10:00:00.000Z",
    currentVersion: version,
    ...overrides,
  };
}

const page = (data: DocumentSummary[]) => ({
  data,
  meta: {
    totalItems: data.length,
    itemCount: data.length,
    itemsPerPage: 10,
    totalPages: 1,
    currentPage: 1,
  },
});

function listReturns(state: Record<string, unknown>) {
  mocks.list.mockReturnValue({
    isLoading: false,
    isFetching: false,
    error: undefined,
    currentData: undefined,
    refetch: vi.fn(),
    ...state,
  });
}

const render = (overrides: Partial<Contract> = {}) =>
  renderToStaticMarkup(
    <ContractDocuments
      companyId="company-1"
      contract={{ ...contract, ...overrides }}
    />,
  );

describe("ContractDocuments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("asks for the first page of this contract's documents", () => {
    listReturns({ currentData: page([]) });
    render();
    expect(mocks.list).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
      page: 1,
      limit: 10,
    });
  });

  it("shows a loading state first", () => {
    listReturns({ isLoading: true });
    const markup = render();
    expect(markup).toContain('aria-label="Loading documents"');
    expect(markup).not.toContain("Upload document");
  });

  it("explains, instead of erroring, when the user has no role on the contract", () => {
    listReturns({
      error: {
        status: 403,
        data: { message: "Your role does not have access" },
      },
    });
    const markup = render();
    expect(markup).toContain("Documents are shared with the contract team");
    expect(markup).toContain("assign contract roles");
    expect(markup).not.toContain("Retry");
    expect(markup).not.toContain("Upload document");
  });

  it("offers a retry when loading fails for another reason", () => {
    listReturns({
      error: { status: 404, data: { message: "Contract was not found." } },
    });
    const markup = render();
    expect(markup).toContain("Contract was not found.");
    expect(markup).toContain("Retry");
  });

  it("shows an empty state with the allowed types, and the upload action", () => {
    listReturns({ currentData: page([]) });
    const markup = render();
    expect(markup).toContain("No documents yet");
    expect(markup).toContain("up to 25 MB");
    expect(markup).toContain("Upload document");
  });

  it("allows no uploads on an archived contract", () => {
    listReturns({ currentData: page([]) });
    const markup = render({ deletedAt: "2026-11-01T00:00:00.000Z" });
    expect(markup).toContain("This contract is archived");
    expect(markup).not.toContain("Upload document");
  });

  it("lists documents with readable labels, versions and sizes", () => {
    listReturns({
      currentData: page([
        document({}),
        document({
          id: "doc-2",
          title: "Crew H2S certificates",
          category: EDocumentCategory.HSE,
          visibility: EDocumentVisibility.PRIVATE,
        }),
      ]),
    });
    const markup = render();
    expect(markup).toContain("Hydrotest procedure");
    expect(markup).toContain("HT-PRO-014");
    expect(markup).toContain("Version 3 · 2.4 MB");
    expect(markup).toContain(">All parties<");
    expect(markup).toContain(">Your company only<");
    expect(markup).toContain(">HSE<");
    expect(markup).toContain("documents");
  });

  it("lets only the uploading company replace or delete a document", () => {
    listReturns({
      currentData: page([
        document({}),
        document({
          id: "doc-2",
          title: "Counterparty drawing",
          ownerCompanyId: "company-2",
        }),
      ]),
    });
    const markup = render();
    expect(markup).toContain('aria-label="Delete Hydrotest procedure"');
    expect(markup).toContain(
      'aria-label="Upload a new version of Hydrotest procedure"',
    );
    expect(markup).not.toContain('aria-label="Delete Counterparty drawing"');
    expect(markup).not.toContain("new version of Counterparty drawing");
    // Anyone who can see a document can download it and see its versions.
    expect(markup).toContain('aria-label="Download Counterparty drawing"');
    expect(markup).toContain(
      'aria-label="Show versions of Counterparty drawing"',
    );
  });

  it("marks an unfinished first upload and offers no download for it", () => {
    listReturns({
      currentData: page([
        document({ title: "Draft report", currentVersion: null }),
      ]),
    });
    const markup = render();
    expect(markup).toContain("Upload pending");
    expect(markup).not.toContain('aria-label="Download Draft report"');
  });

  it("keeps changes to an archived contract's documents out of reach", () => {
    listReturns({ currentData: page([document({})]) });
    const markup = render({ deletedAt: "2026-11-01T00:00:00.000Z" });
    expect(markup).toContain('aria-label="Download Hydrotest procedure"');
    expect(markup).not.toContain('aria-label="Delete Hydrotest procedure"');
  });
});

describe("CompanyDocuments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const companyDocument = (overrides: Partial<DocumentSummary> = {}) =>
    document({
      contractId: null,
      title: "Insurance master policy",
      visibility: EDocumentVisibility.PRIVATE,
      ...overrides,
    });
  const renderCompany = (canManage: boolean) =>
    renderToStaticMarkup(
      <CompanyDocuments companyId="company-1" canManage={canManage} />,
    );

  it("asks for the company's own library, without a contract", () => {
    listReturns({ currentData: page([]) });
    renderCompany(true);
    expect(mocks.list).toHaveBeenCalledWith({
      companyId: "company-1",
      page: 1,
      limit: 10,
    });
  });

  it("lets administrators upload, replace and delete", () => {
    listReturns({ currentData: page([companyDocument()]) });
    const markup = renderCompany(true);
    expect(markup).toContain("Upload document");
    expect(markup).toContain('aria-label="Delete Insurance master policy"');
    expect(markup).toContain(
      'aria-label="Upload a new version of Insurance master policy"',
    );
  });

  it("gives members read-only access", () => {
    listReturns({ currentData: page([companyDocument()]) });
    const markup = renderCompany(false);
    expect(markup).not.toContain("Upload document");
    expect(markup).not.toContain('aria-label="Delete Insurance master policy"');
    expect(markup).toContain('aria-label="Download Insurance master policy"');
  });

  it("has no sharing choice, because company documents are never shared", () => {
    listReturns({ currentData: page([companyDocument()]) });
    const markup = renderCompany(true);
    expect(markup).not.toContain("Shared with");
    expect(markup).not.toContain("All parties");
  });

  it("explains an empty library to members who can't add to it", () => {
    listReturns({ currentData: page([]) });
    expect(renderCompany(false)).toContain("Your Company Administrators haven");
  });
});

describe("document form validation", () => {
  const pdf = new File(["%PDF-1.7"], "Signed contract.pdf", {
    type: "application/pdf",
  });
  const valid = {
    title: "Signed contract",
    documentNumber: "",
    category: EDocumentCategory.CONTRACT,
    visibility: EDocumentVisibility.PUBLIC,
    file: pdf,
    changeNote: "",
  };

  it("accepts a titled document with an allowed file", () => {
    expect(newDocumentSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a title and a file", () => {
    const result = newDocumentSchema.safeParse({
      ...valid,
      title: "  ",
      file: null,
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map(({ message }) => message);
    expect(messages).toContain("Enter a title.");
    expect(messages).toContain("Choose a file to upload.");
  });

  it("explains a file type the API would refuse", () => {
    const result = newVersionSchema.safeParse({
      file: new File(["x"], "macro.docm"),
      changeNote: "",
    });
    expect(result.error?.issues[0]?.message).toMatch(/can't be uploaded/);
  });
});
