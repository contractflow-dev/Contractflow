// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { ContractDocuments } from "./contract-documents";

vi.setConfig({ testTimeout: 20_000 });

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
  currentVersion: {
    id: "version-1",
    versionNumber: 1,
    fileName: "Hydrotest procedure.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_048_576,
    checksumSha256: "a".repeat(64),
    changeNote: "",
    uploadStatus: EDocumentUploadStatus.AVAILABLE,
    uploadedById: "member-1",
    uploadedAt: "2026-11-01T10:00:00.000Z",
  },
};

const mocks = vi.hoisted(() => ({ hash: vi.fn() }));

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
  useGetContractDocumentQuery: () => ({ isLoading: false }),
  useCreateDocumentUploadMutation: () => [vi.fn()],
  useCreateDocumentVersionUploadMutation: () => [vi.fn()],
  useCompleteDocumentUploadMutation: () => [vi.fn()],
  useCreateDocumentDownloadUrlMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteContractDocumentMutation: () => [
    vi.fn(),
    { isLoading: false, reset: vi.fn() },
  ],
}));
// The upload's first step, hashing the file, is held open by the tests that
// need an upload in progress.
vi.mock("@/lib/presignedUpload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/presignedUpload")>()),
  sha256Hex: mocks.hash,
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));
vi.mock("@/lib/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

const contract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Pipeline integrity",
  contractType: Object.values(EContractType)[0],
  status: EContractStatus.ACTIVE,
  deletedAt: null,
} as Contract;

beforeEach(() => {
  mocks.hash.mockReset();
  mocks.hash.mockReturnValue(new Promise(() => undefined));
});
afterEach(cleanup);

function setup() {
  const user = userEvent.setup({ delay: null });
  render(<ContractDocuments companyId="company-1" contract={contract} />);
  return user;
}

describe("document upload dialogs", () => {
  it("uploads a document from a dialog, not a form above the list", async () => {
    const user = setup();
    expect(
      screen.queryByRole("form", { name: "Upload a document" }),
    ).toBeNull();

    const button = screen.getByRole("button", { name: "Upload document" });
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    await user.click(button);

    const dialog = await screen.findByRole("dialog", {
      name: "Upload a document",
    });
    const form = within(dialog);
    expect(form.getByLabelText(/^Title/)).toBeTruthy();
    expect(form.getByLabelText(/Shared with/)).toBeTruthy();
    expect(form.getByLabelText(/^File/)).toBeTruthy();

    await user.click(form.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("uploads a new version of a document from its own dialog", async () => {
    const user = setup();
    const [, tableButton] = screen.getAllByRole("button", {
      name: "Upload a new version of Hydrotest procedure",
    });
    expect(tableButton.getAttribute("aria-haspopup")).toBe("dialog");
    await user.click(tableButton);

    const dialog = await screen.findByRole("dialog", {
      name: "New version of Hydrotest procedure",
    });
    expect(within(dialog).getByLabelText(/^File/)).toBeTruthy();
    expect(within(dialog).queryByLabelText(/^Title/)).toBeNull();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("can't be closed while a file is uploading", async () => {
    const user = setup();
    await user.click(
      screen.getAllByRole("button", {
        name: "Upload a new version of Hydrotest procedure",
      })[1],
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();

    await user.upload(
      within(dialog).getByLabelText(/^File/),
      new File(["%PDF-1.7"], "Hydrotest procedure rev 2.pdf", {
        type: "application/pdf",
      }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Upload new version" }),
    );
    await waitFor(() => expect(mocks.hash).toHaveBeenCalled());

    // The upload has started: no close button, and Escape is ignored.
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("button", { name: "Close" }),
      ).toBeNull(),
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Cancel",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
