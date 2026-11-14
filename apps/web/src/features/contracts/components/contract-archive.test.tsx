import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArchiveContractDialog,
  ArchivedContractNotice,
  RestoreContractButton,
} from "./contract-archive";

const mocks = vi.hoisted(() => ({
  impact: vi.fn(),
  permissions: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  dialogProps: {} as {
    confirmDisabled?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  },
}));

vi.mock("@/services/contractApi", () => ({
  useGetContractDeletionImpactQuery: mocks.impact,
  useGetContractLifecyclePermissionsQuery: mocks.permissions,
  useArchiveContractMutation: () => [mocks.archive, { isLoading: false }],
  useRestoreContractMutation: () => [mocks.restore, { isLoading: false }],
}));
// The dialog's content without its portal (not rendered on the server); its
// props are kept so the tests can press its buttons.
vi.mock("@/components/confirm-dialog/confirm-dialog", () => ({
  ConfirmDialog: (props: {
    title: ReactNode;
    description: ReactNode;
    children?: ReactNode;
    confirmLabel: string;
    confirmDisabled?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    Object.assign(mocks.dialogProps, props);
    return (
      <div
        role="alertdialog"
        data-confirm-disabled={String(Boolean(props.confirmDisabled))}
      >
        <h2>{props.title}</h2>
        <div>{props.description}</div>
        {props.children}
        <button type="button">{props.confirmLabel}</button>
      </div>
    );
  },
}));

const contract = {
  id: "contract-1",
  referenceNumber: "CF-2026-0142",
  title: "Pipeline integrity",
};

const renderDialog = (onCancel = vi.fn()) =>
  renderToStaticMarkup(
    <ArchiveContractDialog
      companyId="company-1"
      contract={contract}
      onCancel={onCancel}
      onArchived={vi.fn()}
    />,
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.archive.mockReturnValue({ unwrap: () => Promise.resolve() });
  mocks.impact.mockReturnValue({
    currentData: {
      activeRoleAssignmentCount: 4,
      workspaceAdminCount: 1,
      pendingRoleInvitationCount: 2,
      pendingPartyInvitationCount: 1,
      otherPartyCount: 1,
      subcontractCount: 2,
    },
    isFetching: false,
  });
});

describe("ArchiveContractDialog", () => {
  it("names the contract and says what ends, what is kept and how to restore it", () => {
    const markup = renderDialog();

    expect(mocks.impact).toHaveBeenCalledWith(
      { companyId: "company-1", contractId: "contract-1" },
      { refetchOnMountOrArgChange: true },
    );
    expect(markup).toContain("Archive CF-2026-0142?");
    expect(markup).toContain("CF-2026-0142 · Pipeline integrity");
    expect(markup).toContain(
      "It revokes 4 contract roles (1 workspace administrator), 2 pending role invitations, 1 pending company invitation, for every company on the contract.",
    );
    expect(markup).toContain("1 other company will no longer see it.");
    expect(markup).toContain("Its 2 subcontracts stay active.");
    expect(markup).toContain("Nothing is deleted");
    expect(markup).toContain("roles must then be assigned again");
  });

  it("can't be confirmed until the reference is typed, so one click can't archive", () => {
    const markup = renderDialog();

    expect(markup).toContain("Type <span");
    expect(markup).toContain('data-confirm-disabled="true"');
    // Even if the confirm action fires, nothing is archived yet.
    mocks.dialogProps.onConfirm?.();
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it("archives nothing when cancelled", () => {
    const onCancel = vi.fn();
    renderDialog(onCancel);

    mocks.dialogProps.onCancel?.();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it("waits for the impact, and shows the API's reason when it can't be checked", () => {
    mocks.impact.mockReturnValue({ currentData: undefined, isFetching: true });
    expect(renderDialog()).toContain("Checking what this affects…");

    mocks.impact.mockReturnValue({
      currentData: undefined,
      isFetching: false,
      error: {
        status: 404,
        data: { message: "Contract was not found." },
      },
    });
    const markup = renderDialog();
    expect(markup).toContain("Contract was not found.");
    expect(markup).toContain('data-confirm-disabled="true"');
  });

  it("says plainly when nobody is affected", () => {
    mocks.impact.mockReturnValue({
      currentData: {
        activeRoleAssignmentCount: 0,
        workspaceAdminCount: 0,
        pendingRoleInvitationCount: 0,
        pendingPartyInvitationCount: 0,
        otherPartyCount: 0,
        subcontractCount: 0,
      },
      isFetching: false,
    });

    expect(renderDialog()).toContain(
      "Nobody holds a role on it and no invitations are pending.",
    );
  });
});

describe("RestoreContractButton", () => {
  it("names the contract it restores", () => {
    const markup = renderToStaticMarkup(
      <RestoreContractButton companyId="company-1" contract={contract} />,
    );

    expect(markup).toContain(
      'aria-label="Restore CF-2026-0142 · Pipeline integrity"',
    );
    expect(markup).toContain(">Restore</button>");
  });
});

describe("ArchivedContractNotice", () => {
  const archived = { ...contract, deletedAt: "2026-06-01T09:30:00.000Z" };

  it("says the contract is read-only and offers restore when the API allows it", () => {
    mocks.permissions.mockReturnValue({ currentData: { canRestore: true } });

    const markup = renderToStaticMarkup(
      <ArchivedContractNotice companyId="company-1" contract={archived} />,
    );

    expect(markup).toContain("Archived contract · read-only");
    expect(markup).toContain("can&#x27;t be changed");
    expect(markup).toContain(">Restore</button>");
  });

  it("offers no restore without the API's permission", () => {
    mocks.permissions.mockReturnValue({ currentData: { canRestore: false } });

    const markup = renderToStaticMarkup(
      <ArchivedContractNotice companyId="company-1" contract={archived} />,
    );

    expect(markup).toContain("Archived contract · read-only");
    expect(markup).not.toContain(">Restore</button>");
  });

  it("shows nothing for a contract in use", () => {
    mocks.permissions.mockReturnValue({ currentData: { canRestore: false } });

    expect(
      renderToStaticMarkup(
        <ArchivedContractNotice
          companyId="company-1"
          contract={{ ...contract, deletedAt: null }}
        />,
      ),
    ).toBe("");
  });
});
