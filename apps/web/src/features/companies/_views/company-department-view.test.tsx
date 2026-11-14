import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ECompanyDepartment,
  EContractStatus,
  EDepartmentBlockerType,
  EDepartmentContractSort,
  EPartyType,
  type DepartmentContract,
  type DepartmentContractsResponse,
} from "@contractflow/contracts-schema";
import {
  DepartmentContracts,
  departmentFiltersQuery,
  readDepartmentFilters,
} from "./company-department-view";
import { departmentContractsCsv } from "../department-csv";

const mocks = vi.hoisted(() => ({
  contracts: vi.fn(),
  lazy: vi.fn(),
  search: "",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboards/departments/hse",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/services/contractApi", () => ({
  useGetCompanyDepartmentContractsQuery: mocks.contracts,
  useLazyGetCompanyDepartmentContractsQuery: () => [mocks.lazy],
}));
vi.mock("@/lib/notify", () => ({ notifyError: vi.fn() }));

const waitingOnUs: DepartmentContract = {
  contractId: "contract-1",
  referenceNumber: "CF-2026-0142",
  title: "Pipeline integrity",
  status: EContractStatus.ACTIVE,
  archived: false,
  partyType: EPartyType.CLIENT,
  memberCount: 0,
  members: [],
  workspaceAdmins: [],
  primaryBlocker: {
    type: EDepartmentBlockerType.NO_MEMBERS,
    label: "Nobody from your company is assigned",
    holder: { companyId: "company-1", companyName: "Acme", myCompany: true },
  },
  otherBlockerCount: 1,
  lastMovementAt: "2026-10-20T10:00:00.000Z",
  daysSinceMovement: 25,
  hasWorkspaceRole: false,
};

const waitingOnOther: DepartmentContract = {
  ...waitingOnUs,
  contractId: "contract-2",
  referenceNumber: "CF-2026-0200",
  title: "Jetty repairs",
  partyType: EPartyType.CONTRACTOR,
  memberCount: 6,
  members: [
    { companyUserId: "m1", firstName: "Ada", lastName: "Lead" },
    { companyUserId: "m2", firstName: "Bo", lastName: "Officer" },
    { companyUserId: "m3", firstName: "Cy", lastName: "Clerk" },
    { companyUserId: "m4", firstName: "Di", lastName: "Doe" },
  ],
  workspaceAdmins: [
    { companyUserId: "m1", firstName: "Ada", lastName: "Lead" },
  ],
  primaryBlocker: {
    type: EDepartmentBlockerType.SIGNATORY_MISSING,
    label: "Ridgeline Ltd hasn’t recorded a signatory",
    holder: {
      companyId: "company-2",
      companyName: "Ridgeline Ltd",
      myCompany: false,
    },
  },
  otherBlockerCount: 0,
  daysSinceMovement: 3,
  hasWorkspaceRole: true,
};

const archived: DepartmentContract = {
  ...waitingOnUs,
  contractId: "contract-3",
  title: "Old works",
  archived: true,
  primaryBlocker: null,
  otherBlockerCount: 0,
};

const response = (
  data: DepartmentContract[],
  summary: Partial<DepartmentContractsResponse["summary"]> = {},
): DepartmentContractsResponse => ({
  data,
  meta: {
    totalItems: data.length,
    itemCount: data.length,
    itemsPerPage: 20,
    totalPages: 1,
    currentPage: 1,
  },
  summary: {
    contractCount: 2,
    memberCount: 6,
    waitingOnMyCompanyCount: 1,
    waitingOnOtherCompaniesCount: 1,
    ...summary,
  },
});

const render = () =>
  renderToStaticMarkup(
    <DepartmentContracts
      companyId="company-1"
      department={ECompanyDepartment.HSE}
    />,
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.search = "";
  mocks.contracts.mockReturnValue({
    currentData: response([waitingOnUs, waitingOnOther]),
    isLoading: false,
    isFetching: false,
  });
});

describe("DepartmentContracts", () => {
  it("asks the API for the department, default order first", () => {
    render();

    expect(mocks.contracts).toHaveBeenCalledWith(
      {
        companyId: "company-1",
        department: "hse",
        page: 1,
        limit: 20,
        sort: EDepartmentContractSort.WAITING_ON_US,
      },
      { refetchOnMountOrArgChange: true },
    );
  });

  it("names the department and links to its staffing (D1)", () => {
    const markup = render();

    expect(markup).toContain(">HSE</h1>");
    expect(markup).toMatch(
      /href="\/dashboards\/team\?workspace=hse#contract-roles"[^>]*>.*Manage staffing/,
    );
  });

  it("shows the four figures, each linking to its filter", () => {
    const markup = render();

    for (const label of [
      "Contracts in this workspace",
      "Our members in this workspace",
      "Contracts waiting on us",
      "Contracts waiting on other companies",
    ]) {
      expect(markup).toContain(`>${label}</p>`);
    }
    expect(markup).toContain('href="/dashboards/departments/hse?waitingOn=us"');
    expect(markup).toContain(
      'href="/dashboards/departments/hse?waitingOn=others"',
    );
  });

  it("marks a blocker held by us, and names another company's", () => {
    const markup = render();

    expect(markup).toContain(">Waiting on us</span>");
    expect(markup).toContain("Nobody from your company is assigned");
    expect(markup).toContain("+1 other");
    expect(markup).toContain(">Waiting on Ridgeline Ltd</span>");
  });

  it("shows party type, staffing, admin and movement for each row", () => {
    const markup = render();

    expect(markup).toContain(">Client</span>");
    expect(markup).toContain(">Contractor</span>");
    expect(markup).toContain(">Unstaffed</span>");
    expect(markup).toContain(">No admin</span>");
    expect(markup).toContain("Ada Lead");
    // Four avatars, then the rest as a count; the link names everyone shown.
    expect(markup).toContain(">+2</div>");
    expect(markup).toContain(
      'aria-label="6 members from our company on Jetty repairs: Ada Lead, Bo Officer, Cy Clerk, Di Doe and 2 more"',
    );
    expect(markup).toContain(
      'href="/dashboards/contracts/contract-2/roles?workspace=hse"',
    );
    expect(markup).toContain(">25 days</span>");
  });

  it("offers Open workspace only to an administrator holding a role there", () => {
    const markup = render();

    expect(markup).toContain(
      'href="/dashboards/contracts/contract-2/workspaces/hse"',
    );
    expect(markup).not.toContain("/contracts/contract-1/workspaces/");
    expect(markup).toContain('aria-label="Open contract Pipeline integrity"');
    expect(markup).toContain(
      'aria-label="Assign a member to HSE on Pipeline integrity"',
    );
  });

  it("labels archived contracts and offers them read-only", () => {
    mocks.search = "archived=1";
    mocks.contracts.mockReturnValue({
      currentData: response([archived]),
      isLoading: false,
    });

    const markup = render();

    expect(markup).toContain("Archived, read-only");
    expect(markup).not.toContain("Assign a member to HSE on Old works");
    expect(mocks.contracts).toHaveBeenCalledWith(
      expect.objectContaining({ includeArchived: true }),
      expect.anything(),
    );
  });

  it("reads every filter from the URL", () => {
    mocks.search =
      "search=pipe&status=active&partyType=contractor&waitingOn=others&sort=title&page=2&limit=50";

    render();

    expect(mocks.contracts).toHaveBeenCalledWith(
      {
        companyId: "company-1",
        department: "hse",
        page: 2,
        limit: 50,
        sort: EDepartmentContractSort.TITLE,
        search: "pipe",
        status: EContractStatus.ACTIVE,
        partyType: EPartyType.CONTRACTOR,
        waitingOn: "others",
      },
      { refetchOnMountOrArgChange: true },
    );
  });

  it("explains an empty department, and an empty filter apart", () => {
    mocks.contracts.mockReturnValue({
      currentData: response([], { contractCount: 0 }),
      isLoading: false,
    });
    expect(render()).toContain("No contracts have the HSE workspace yet");

    mocks.search = "status=draft";
    const filtered = render();
    expect(filtered).toContain("No contracts match these filters.");
    expect(filtered).toContain(">Clear filters</a>");
  });

  it("shows loading, refusal and failure states", () => {
    mocks.contracts.mockReturnValue({ isLoading: true });
    expect(render()).toContain('aria-label="Loading contracts"');

    mocks.contracts.mockReturnValue({
      isLoading: false,
      error: { status: 403, data: { message: "Forbidden" } },
    });
    expect(render()).toContain("This page is for Company Administrators");

    mocks.contracts.mockReturnValue({
      isLoading: false,
      error: { status: 500, data: { message: "Down" } },
      refetch: vi.fn(),
    });
    const failed = render();
    expect(failed).toContain("Contracts could not be loaded");
    expect(failed).toContain(">Retry</button>");
  });
});

describe("department filters in the URL", () => {
  it("round-trips, leaving defaults out", () => {
    const filters = readDepartmentFilters(
      new URLSearchParams("partyType=client&waitingOn=us&archived=1&page=3"),
    );
    expect(filters).toMatchObject({
      partyType: EPartyType.CLIENT,
      waitingOn: "us",
      includeArchived: true,
      page: 3,
      sort: EDepartmentContractSort.WAITING_ON_US,
    });
    expect(departmentFiltersQuery(filters)).toBe(
      "partyType=client&waitingOn=us&archived=1&page=3",
    );
  });

  it("drops unknown values and caps the page size", () => {
    expect(
      readDepartmentFilters(
        new URLSearchParams("status=lost&sort=random&limit=5000&page=-1"),
      ),
    ).toMatchObject({
      status: undefined,
      sort: EDepartmentContractSort.WAITING_ON_US,
      limit: 100,
      page: 1,
    });
  });
});

describe("department CSV", () => {
  it("has one row per contract, with whose move it is", () => {
    const csv = departmentContractsCsv([waitingOnUs, waitingOnOther]);
    const lines = csv.split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Reference,Contract,Our party type");
    expect(lines[1]).toContain("CF-2026-0142,Pipeline integrity,Client");
    expect(lines[1]).toContain(",Us,1,25,");
    expect(lines[2]).toContain("Ridgeline Ltd");
  });

  it("quotes separators and defuses formulas", () => {
    const csv = departmentContractsCsv([
      { ...waitingOnUs, title: '=HYPERLINK("x"), now' },
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""x""), now"`);
  });
});
