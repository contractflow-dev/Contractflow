import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractStatus,
  EContractorContractRole,
} from "@contractflow/contracts-schema";
import type { DataTableFilterField } from "@/components/data-table/data-table-filters";
import type { CompanyRoleAssignment } from "@/services/contractApi";
import { CompanyContractRoles } from "./company-contract-roles";

const mocks = vi.hoisted(() => ({
  roles: vi.fn(),
  search: "",
  replace: vi.fn(),
  filterFields: [] as readonly DataTableFilterField[],
}));

// The real dropdown, keeping the fields it was given: its options render
// only once it is open.
vi.mock("@/components/data-table/data-table-filters", async (original) => {
  const actual =
    await original<
      typeof import("@/components/data-table/data-table-filters")
    >();
  return {
    ...actual,
    DataTableFilters: (
      props: ComponentProps<typeof actual.DataTableFilters>,
    ) => {
      mocks.filterFields = props.fields;
      return <actual.DataTableFilters {...props} />;
    },
  };
});

// The workspace filter lives in the URL.
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboards/team",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/services/contractApi", () => ({
  useGetCompanyRoleAssignmentsQuery: mocks.roles,
  useRevokeContractRoleMutation: () => [
    vi.fn(),
    { isLoading: false, reset: vi.fn() },
  ],
  useSetContractWorkspaceAdminMutation: () => [
    vi.fn(),
    { isLoading: false, reset: vi.fn() },
  ],
}));
vi.mock("@/services/companiesApi", () => ({
  useGetCompanyMembersQuery: () => ({
    currentData: {
      data: [
        {
          id: "member-1",
          firstName: "Casey",
          lastName: "Okafor",
          email: "casey@acme.test",
        },
      ],
    },
  }),
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));

const row: CompanyRoleAssignment = {
  id: "assignment-1",
  contractId: "contract-1",
  contractReference: "CF-2026-0142",
  contractTitle: "Pipeline integrity",
  contractStatus: EContractStatus.ACTIVE,
  companyUserId: "member-1",
  firstName: "Casey",
  lastName: "Okafor",
  email: "casey@acme.test",
  role: EContractorContractRole.HSE_OFFICER,
  workspace: "hse",
  isWorkspaceAdmin: true,
  assignedAt: "2026-11-01T10:00:00.000Z",
};

const page = (data: CompanyRoleAssignment[]) => ({
  data,
  meta: {
    totalItems: data.length,
    itemCount: data.length,
    itemsPerPage: 10,
    totalPages: 1,
    currentPage: 1,
  },
});

const render = () =>
  renderToStaticMarkup(<CompanyContractRoles companyId="company-1" />);

describe("CompanyContractRoles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.search = "";
  });

  it("applies the workspace filter from the URL, and marks the section for links", () => {
    mocks.search = "workspace=hse";
    mocks.roles.mockReturnValue({ currentData: page([row]) });

    const markup = render();

    expect(mocks.roles).toHaveBeenCalledWith(
      { companyId: "company-1", page: 1, limit: 10, workspace: "hse" },
      { refetchOnMountOrArgChange: true },
    );
    expect(markup).toContain('id="contract-roles"');
    // The Filters trigger counts the workspace from the URL.
    expect(markup).toMatch(/Filters<span[^>]*>1<span[^>]*> active/);
  });

  it("ignores an unknown workspace in the URL", () => {
    mocks.search = "workspace=payroll";
    mocks.roles.mockReturnValue({ isLoading: true });

    render();

    expect(mocks.roles).toHaveBeenCalledWith(
      { companyId: "company-1", page: 1, limit: 10 },
      { refetchOnMountOrArgChange: true },
    );
  });

  it("asks for the header company's roles, first page, without filters", () => {
    mocks.roles.mockReturnValue({ isLoading: true });
    render();
    expect(mocks.roles).toHaveBeenCalledWith(
      { companyId: "company-1", page: 1, limit: 10 },
      { refetchOnMountOrArgChange: true },
    );
  });

  it("lists each role with its member, contract, workspace and admin flag", () => {
    mocks.roles.mockReturnValue({ currentData: page([row]) });
    const markup = render();
    expect(markup).toContain(">Role assignments</h2>");
    expect(markup).toContain("casey@acme.test");
    expect(markup).toContain('href="/dashboards/contracts/contract-1/roles"');
    expect(markup).toContain("CF-2026-0142");
    expect(markup).toContain("HSE Officer");
    expect(markup).toContain("Workspace admin");
    expect(markup).toContain(
      'aria-label="Revoke HSE Officer from Casey Okafor on Pipeline integrity"',
    );
    // The member filter is filled from the company's active members.
    const memberFilter = mocks.filterFields.find(({ id }) => id === "member");
    expect(
      memberFilter?.kind === "select" ? memberFilter.options : [],
    ).toContainEqual({ value: "member-1", label: "Casey Okafor" });
  });

  it("offers workspace-admin changes and assignment, without opening a dialog", () => {
    mocks.roles.mockReturnValue({ currentData: page([row]) });
    const markup = render();

    // The row is a workspace admin, so the action removes the right.
    expect(markup).toContain(
      'aria-label="Remove workspace administrator rights from Casey Okafor for HSE on Pipeline integrity"',
    );
    expect(markup).toMatch(/<button[^>]*>Assign a contract role<\/button>/);
    // Confirmations and the assignment form only open on request.
    expect(markup).not.toContain("Revoke this contract role?");
    expect(markup).not.toContain("Assign to a contract");
  });

  it("explains where roles come from when there are none", () => {
    mocks.roles.mockReturnValue({ currentData: page([]) });
    expect(render()).toContain("No contract roles yet");
  });

  it("offers a retry when the roles can't be loaded", () => {
    mocks.roles.mockReturnValue({
      error: {
        status: 403,
        data: {
          message:
            "Only a Company Administrator can view contract roles across the company.",
        },
      },
      refetch: vi.fn(),
    });
    const markup = render();
    expect(markup).toContain("Only a Company Administrator can view");
    expect(markup).toContain("Retry");
  });
});
