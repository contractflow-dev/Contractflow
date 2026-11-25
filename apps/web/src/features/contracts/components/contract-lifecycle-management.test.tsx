import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EContractStatus } from "@contractflow/contracts-schema";
import type { Contract } from "@/services/contractApi";
import { ContractLifecycleManagement } from "./contract-lifecycle-management";

const mocks = vi.hoisted(() => ({
  permissions: { canManage: true, canTransition: false } as Record<
    string,
    boolean
  >,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./contract-archive", () => ({ ArchiveContractDialog: () => null }));
vi.mock("@/services/contractApi", () => ({
  useGetContractLifecyclePermissionsQuery: () => ({
    isLoading: false,
    isError: false,
    data: mocks.permissions,
  }),
  useGetContractPartyInvitationsQuery: () => ({ currentData: [] }),
  useTransitionContractMutation: () => [vi.fn(), { isLoading: false }],
  useCreateContractPartyInvitationMutation: () => [
    vi.fn(),
    { isLoading: false },
  ],
  useRevokeContractPartyInvitationMutation: () => [
    vi.fn(),
    { isLoading: false },
  ],
}));

const contract = {
  id: "contract-1",
  referenceNumber: "CTR-001",
  title: "Pipeline maintenance",
  status: EContractStatus.ACTIVE,
  deletedAt: null,
} as Contract;

const render = (overrides: Partial<Contract> = {}) =>
  renderToStaticMarkup(
    <ContractLifecycleManagement
      companyId="company-1"
      contract={{ ...contract, ...overrides }}
      part="manage"
    />,
  );

describe("Manage contract", () => {
  beforeEach(() => {
    mocks.permissions = { canManage: true, canTransition: false };
  });

  it("sends the managing company to the edit page instead of an inline form", () => {
    const markup = render();
    expect(markup).toMatch(
      /<a[^>]*href="\/dashboards\/contracts\/contract-1\/edit"[^>]*>Edit contract<\/a>/,
    );
    expect(markup).not.toContain("Save details");
  });

  it("offers no edit to someone who can only change the status", () => {
    mocks.permissions = { canManage: false, canTransition: true };
    expect(render()).not.toContain("Edit contract");
  });

  it("offers no edit on an archived contract", () => {
    expect(render({ deletedAt: "2026-06-01T00:00:00.000Z" })).not.toContain(
      ">Edit contract<",
    );
  });
});

describe("Party invitations", () => {
  const renderInvitations = () =>
    renderToStaticMarkup(
      <ContractLifecycleManagement
        companyId="company-1"
        contract={contract}
        part="invitations"
      />,
    );

  it("offers company invitations on a main contract to whoever may invite", () => {
    mocks.permissions = {
      canManage: true,
      canTransition: false,
      canInviteParties: true,
      invitesSubcontractors: false,
    };
    const markup = renderInvitations();
    expect(markup).toContain("Company invitations");
    expect(markup).toContain("Invite Company");
  });

  it("lets the main contractor's Project Lead invite a subcontractor without admin rights", () => {
    mocks.permissions = {
      canManage: false,
      canTransition: false,
      canInviteParties: true,
      invitesSubcontractors: true,
    };
    const markup = renderInvitations();
    expect(markup).toContain("Subcontractor invitations");
    expect(markup).toContain("Invite Subcontractor");
    expect(markup).not.toContain("Invite Company");
  });

  it("offers no invitations to an administrator who may not invite on a subcontract", () => {
    // Administrator rights alone: the API refuses, so nothing is offered.
    mocks.permissions = {
      canManage: true,
      canTransition: false,
      canInviteParties: false,
      invitesSubcontractors: true,
    };
    const markup = renderInvitations();
    expect(markup).not.toContain("Invite Subcontractor");
    expect(markup).not.toContain("Subcontractor invitations");
  });

  it("shows no empty Manage card to someone who may only invite", () => {
    mocks.permissions = {
      canManage: false,
      canTransition: false,
      canInviteParties: true,
      invitesSubcontractors: true,
    };
    expect(render()).not.toContain("Manage contract");
  });
});
