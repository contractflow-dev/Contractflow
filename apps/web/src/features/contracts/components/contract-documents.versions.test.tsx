// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EContractStatus,
  EContractType,
  EDocumentCategory,
  EDocumentStatus,
  EDocumentUploadStatus,
  EDocumentVisibility,
  type ContractActivityTarget,
} from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import type { DocumentSummary } from "@/services/documentsApi";
import { ContractDocuments } from "./contract-documents";

vi.setConfig({ testTimeout: 20_000 });

const version = (n: number, id: string) => ({
  id,
  versionNumber: n,
  fileName: `Hydrotest procedure rev ${n}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 1_048_576,
  checksumSha256: "a".repeat(64),
  changeNote: "",
  uploadStatus: EDocumentUploadStatus.AVAILABLE,
  uploadedById: "member-1",
  uploadedAt: `2026-11-0${n}T10:00:00.000Z`,
});

const summary: DocumentSummary = {
  id: "doc-1",
  contractId: "contract-1",
  ownerCompanyId: "company-1",
  title: "Hydrotest procedure",
  documentNumber: "HT-PRO-014",
  category: EDocumentCategory.CONTRACT,
  visibility: EDocumentVisibility.PUBLIC,
  status: EDocumentStatus.VALID,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-03T10:00:00.000Z",
  currentVersion: version(3, "version-3"),
};

const mocks = vi.hoisted(() => ({ detail: vi.fn() }));

vi.mock("@/services/documentsApi", () => ({
  useGetContractDocumentsQuery: () => ({
    isLoading: false,
    isFetching: false,
    error: undefined,
    currentData: {
      data: [summary],
      meta: {
        totalItems: 1,
        itemCount: 1,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      },
    },
    refetch: vi.fn(),
  }),
  useGetContractDocumentQuery: mocks.detail,
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

beforeEach(() => {
  mocks.detail.mockImplementation(
    (_args: unknown, options?: { skip?: boolean }) =>
      options?.skip
        ? { isLoading: false }
        : {
            isLoading: false,
            error: undefined,
            currentData: {
              ...summary,
              versions: [
                version(1, "version-1"),
                version(3, "version-3"),
                version(2, "version-2"),
              ],
            },
          },
  );
});
afterEach(cleanup);

function setup(target?: ContractActivityTarget) {
  const user = userEvent.setup({ delay: null });
  render(
    <ContractDocuments
      companyId="company-1"
      contract={contract}
      target={target}
    />,
  );
  return user;
}

describe("document version history sheet", () => {
  it("opens a document's versions in a side sheet, newest first, without growing the table", async () => {
    const user = setup();
    expect(screen.queryByRole("dialog")).toBeNull();

    const [, tableButton] = screen.getAllByRole("button", {
      name: "Show versions of Hydrotest procedure",
    });
    expect(tableButton.getAttribute("aria-haspopup")).toBe("dialog");
    await user.click(tableButton);

    const sheet = await screen.findByRole("dialog", {
      name: "Versions of Hydrotest procedure",
    });
    const versions = within(sheet).getAllByRole("listitem");
    expect(versions.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Version 3"),
      expect.stringContaining("Version 2"),
      expect.stringContaining("Version 1"),
    ]);
    expect(
      within(sheet).getByRole("button", { name: "Download version 2" }),
    ).toBeTruthy();
    // The table keeps one row per document: nothing opens inside it. (The
    // modal sheet hides the page behind it from assistive technology.)
    const table = screen.getByRole("table", {
      name: "Documents",
      hidden: true,
    });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(2);
  });

  it("closes with Escape", async () => {
    const user = setup();
    await user.click(
      screen.getAllByRole("button", {
        name: "Show versions of Hydrotest procedure",
      })[1],
    );
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens from an activity link, marking the version it points at", async () => {
    setup({
      type: "document",
      id: "doc-1",
      section: "documents",
      versionId: "version-2",
    } as ContractActivityTarget);

    const sheet = await screen.findByRole("dialog", {
      name: "Versions of Hydrotest procedure",
    });
    const marked = within(sheet)
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "true");
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toContain("Version 2");
  });
});
