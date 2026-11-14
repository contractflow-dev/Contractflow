import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContractWorkspaceManagement,
  RemoveWorkspaceDialog,
} from "./contract-workspace-management";

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  permissions: vi.fn(),
  impact: vi.fn(),
  mutation: () => [vi.fn(), { isLoading: false, reset: vi.fn() }],
}));

vi.mock("@/services/contractApi", () => ({
  useGetContractWorkspacesQuery: mocks.workspaces,
  useGetContractLifecyclePermissionsQuery: mocks.permissions,
  useGetContractWorkspaceRemovalImpactQuery: mocks.impact,
  useAddContractWorkspaceMutation: mocks.mutation,
  useRemoveContractWorkspaceMutation: mocks.mutation,
}));
// The dialog's content, without its portal (not rendered on the server).
vi.mock("@/components/confirm-dialog/confirm-dialog", () => ({
  ConfirmDialog: (props: {
    title: ReactNode;
    description: ReactNode;
    error?: ReactNode;
    confirmLabel: string;
    confirmDisabled?: boolean;
  }) => (
    <div
      role="alertdialog"
      data-confirm-disabled={String(Boolean(props.confirmDisabled))}
    >
      <h2>{props.title}</h2>
      <div>{props.description}</div>
      {props.error ? <p>{props.error}</p> : null}
      <button type="button">{props.confirmLabel}</button>
    </div>
  ),
}));

const render = () =>
  renderToStaticMarkup(
    <ContractWorkspaceManagement
      companyId="company-1"
      contractId="contract-1"
      contractReference="CF-2026-0142"
    />,
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspaces.mockReturnValue({ currentData: ["project", "hse"] });
  mocks.permissions.mockReturnValue({ currentData: { canManage: true } });
});

describe("ContractWorkspaceManagement", () => {
  it("lists the contract's workspaces in the order of the domain's options", () => {
    mocks.workspaces.mockReturnValue({ currentData: ["hse", "project"] });

    const markup = render();

    expect(mocks.workspaces).toHaveBeenCalledWith({
      companyId: "company-1",
      contractId: "contract-1",
    });
    const project = markup.indexOf("Project workspace");
    const hse = markup.indexOf("HSE workspace");
    expect(project).toBeGreaterThan(-1);
    expect(hse).toBeGreaterThan(project);
    expect(markup).not.toContain("Finance workspace");
    expect(markup).toContain("only with a contract role in it");
  });

  it("offers only the missing workspaces to add, and a removal per workspace, to a manager", () => {
    const markup = render();

    const select = markup.slice(
      markup.indexOf("<select"),
      markup.indexOf("</select>"),
    );
    expect([...select.matchAll(/value="([^"]*)"/g)].map(([, v]) => v)).toEqual([
      "",
      "finance",
    ]);
    expect(markup).toContain('aria-label="Remove the Project workspace"');
    expect(markup).toContain('aria-label="Remove the HSE workspace"');
    // Nothing is chosen yet, so nothing can be added.
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it("shows no actions to someone who can't manage the contract", () => {
    mocks.permissions.mockReturnValue({ currentData: { canManage: false } });

    const markup = render();

    expect(markup).toContain("Project workspace");
    expect(markup).not.toContain("Remove the");
    expect(markup).not.toContain("Add a workspace");
  });

  it("says when every workspace is already used", () => {
    mocks.workspaces.mockReturnValue({
      currentData: ["project", "hse", "finance"],
    });

    expect(render()).toContain("This contract uses every available workspace.");
  });

  it("explains an empty contract, and how to start, to a manager", () => {
    mocks.workspaces.mockReturnValue({ currentData: [] });

    const markup = render();

    expect(markup).toContain("This contract has no workspaces yet.");
    expect(markup).toContain("Add one below");
  });

  it("shows loading and the API's error with a retry", () => {
    mocks.workspaces.mockReturnValue({ isLoading: true });
    expect(render()).toContain('aria-label="Loading contract workspaces"');

    mocks.workspaces.mockReturnValue({
      error: { status: 404, data: { message: "Contract was not found." } },
      refetch: vi.fn(),
    });
    const markup = render();
    expect(markup).toContain("Contract was not found.");
    expect(markup).toContain("Retry");
    expect(markup).not.toContain("Add a workspace");
  });
});

describe("RemoveWorkspaceDialog", () => {
  const renderDialog = () =>
    renderToStaticMarkup(
      <RemoveWorkspaceDialog
        companyId="company-1"
        contractId="contract-1"
        contractReference="CF-2026-0142"
        workspace="finance"
        onClose={vi.fn()}
      />,
    );

  it("names the workspace and says how many roles and invitations end, across companies", () => {
    mocks.impact.mockReturnValue({
      currentData: {
        workspace: "finance",
        activeRoleAssignmentCount: 3,
        workspaceAdminCount: 1,
        pendingRoleInvitationCount: 2,
      },
      isFetching: false,
    });

    const markup = renderDialog();

    expect(mocks.impact).toHaveBeenCalledWith(
      {
        companyId: "company-1",
        contractId: "contract-1",
        workspace: "finance",
      },
      { refetchOnMountOrArgChange: true },
    );
    expect(markup).toContain("Remove the Finance workspace?");
    expect(markup).toContain(
      "3 contract roles, including 1 workspace administrator, will be revoked and 2 pending role invitations will be revoked, for every company on the contract.",
    );
    expect(markup).toContain("records, documents and history are kept");
    expect(markup).toContain('data-confirm-disabled="false"');
  });

  it("says plainly when nobody is affected", () => {
    mocks.impact.mockReturnValue({
      currentData: {
        workspace: "finance",
        activeRoleAssignmentCount: 0,
        workspaceAdminCount: 0,
        pendingRoleInvitationCount: 0,
      },
      isFetching: false,
    });

    expect(renderDialog()).toContain(
      "Nobody holds a role in it and no role invitations are pending.",
    );
  });

  it("can't be confirmed until the impact is known", () => {
    mocks.impact.mockReturnValue({ currentData: undefined, isFetching: true });

    const markup = renderDialog();

    expect(markup).toContain("Checking who has access…");
    expect(markup).toContain('data-confirm-disabled="true"');
  });

  it("shows the API's reason when the impact can't be checked", () => {
    mocks.impact.mockReturnValue({
      currentData: undefined,
      isFetching: false,
      error: {
        status: 403,
        data: {
          message: "Only a Company Administrator can manage this contract.",
        },
      },
    });

    const markup = renderDialog();

    expect(markup).toContain(
      "Only a Company Administrator can manage this contract.",
    );
    expect(markup).toContain('data-confirm-disabled="true"');
  });
});
