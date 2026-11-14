import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EContractStatus,
  EContractType,
  ECurrencyCode,
  EPartyType,
} from "@contractflow/contracts-schema";
import type { ContractDetail as ContractDetailResponse } from "@/services/contractApi";
import { useContractDetails } from "../_hooks/use-contract-details";
import {
  contractSectionHref,
  parseContractSection,
  type ContractSection,
} from "../contract-sections";
import { ContractSectionNav } from "./contract-section-nav";
import { ContractDetail } from "./contracts-screens";

// The page reads activity deep-link targets from the URL, as in the App Router.
const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
}));

/** What a section component was given as its deep-link target. */
function targetLabel(target?: {
  type: string;
  id: string;
  section: string;
  versionId?: string;
  workspace?: string;
} | null) {
  if (!target) return "";
  return ` target=${[
    target.type,
    target.id,
    target.section,
    target.versionId ?? "-",
    target.workspace ?? "-",
  ].join(":")}`;
}

const access = vi.hoisted(() => ({
  value: { roles: true, sites: true, signatories: true } as Record<
    "roles" | "sites" | "signatories",
    boolean | undefined
  >,
}));

vi.mock("../_hooks/use-contract-details", () => ({
  useContractDetails: vi.fn(),
}));
vi.mock("../_hooks/use-contract-section-access", () => ({
  useContractSectionAccess: () => access.value,
}));
vi.mock("./contract-role-assignment-management", () => ({
  ContractRoleAssignmentManagement: ({
    target,
  }: {
    target?: Parameters<typeof targetLabel>[0];
  }) => <div>ROLE ASSIGNMENTS{targetLabel(target)}</div>,
}));
vi.mock("./contract-lifecycle-management", () => ({
  ContractLifecycleManagement: ({
    part,
    target,
  }: {
    part: string;
    target?: Parameters<typeof targetLabel>[0];
  }) => (
    <div>
      LIFECYCLE {part}
      {targetLabel(target)}
    </div>
  ),
}));
vi.mock("./create-contract-form", () => ({
  CreateContractForm: () => null,
}));
vi.mock("./contract-signatory-management", () => ({
  ContractSignatoryManagement: () => <div>SIGNATORY</div>,
}));
vi.mock("./contract-documents", () => ({
  ContractDocuments: ({
    target,
  }: {
    target?: Parameters<typeof targetLabel>[0];
  }) => <div>DOCUMENTS{targetLabel(target)}</div>,
}));
vi.mock("./contract-activity", () => ({
  ContractActivity: () => <div>ACTIVITY</div>,
}));
vi.mock("./contract-workspace-screens", () => ({
  ContractWorkspacesCard: () => <div>WORKSPACES</div>,
}));
// Covered by its own tests.
vi.mock("./contract-archive", () => ({
  ArchivedContractNotice: ({
    contract,
  }: {
    contract: { deletedAt: string | null };
  }) => (contract.deletedAt ? <div>ARCHIVED NOTICE</div> : null),
  RestoreContractButton: () => <button type="button">Restore</button>,
}));
// Covered by its own tests.
vi.mock("./contract-workspace-management", () => ({
  ContractWorkspaceManagement: () => <div>WORKSPACE MANAGEMENT</div>,
}));
vi.mock("./contract-site-management", () => ({
  ContractSiteManagement: ({
    target,
  }: {
    target?: Parameters<typeof targetLabel>[0];
  }) => <div>SITES{targetLabel(target)}</div>,
}));
vi.mock("@/hooks/use-user-time-zone", () => ({ useUserTimeZone: () => "UTC" }));

const detail: ContractDetailResponse = {
  contract: {
    id: "contract-1",
    referenceNumber: "CTR-001",
    title: "Pipeline maintenance",
    description: "",
    contractType: Object.values(EContractType)[0],
    status: EContractStatus.ACTIVE,
    parentContractId: null,
    originalValueMinor: "1000",
    currentValueMinor: "1000",
    currencyCode: ECurrencyCode.NGN,
    awardDate: "2026-01-01",
    startDate: "2026-02-01",
    endDate: "2026-12-31",
    revisedEndDate: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  membership: {
    id: "membership-1",
    companyId: "company-1",
    partyType: Object.values(EPartyType)[0],
    signedAt: null,
  },
} as unknown as ContractDetailResponse;

const emptyPage = {
  data: [],
  meta: {
    totalItems: 0,
    itemCount: 0,
    itemsPerPage: 10,
    totalPages: 0,
    currentPage: 1,
  },
};

const loadedDetails = {
  detail,
  error: undefined,
  isLoading: false,
  refetch: vi.fn(),
  parties: [],
  partiesError: undefined,
  partiesLoading: false,
  history: emptyPage,
  historyError: undefined,
  historyLoading: false,
  historyFetching: false,
  setHistoryPage: vi.fn(),
  setHistoryPageSize: vi.fn(),
} as unknown as ReturnType<typeof useContractDetails>;

function render(section: ContractSection) {
  return renderToStaticMarkup(
    <ContractDetail
      companyId="company-1"
      contractId="contract-1"
      section={section}
    />,
  );
}

const sectionMarkers: Record<ContractSection, string> = {
  overview: "LIFECYCLE manage",
  parties: "LIFECYCLE invitations",
  roles: "ROLE ASSIGNMENTS",
  sites: "SITES",
  signatories: "SIGNATORY",
  documents: "DOCUMENTS",
  history: "No status changes have been recorded.",
};

describe("contract detail sections", () => {
  beforeEach(() => {
    navigation.params = new URLSearchParams();
    access.value = { roles: true, sites: true, signatories: true };
    vi.mocked(useContractDetails).mockReturnValue(loadedDetails);
  });

  it.each(Object.keys(sectionMarkers) as ContractSection[])(
    "renders only the %s section's content under the shared header",
    (section) => {
      const markup = render(section);

      expect(markup).toContain(">Pipeline maintenance</h1>");
      expect(markup).toContain(sectionMarkers[section]);
      for (const [other, marker] of Object.entries(sectionMarkers)) {
        if (other !== section) expect(markup, other).not.toContain(marker);
      }
    },
  );

  it("shows the activity timeline on the history section only", () => {
    expect(render("history")).toContain("ACTIVITY");
    for (const section of Object.keys(sectionMarkers) as ContractSection[]) {
      if (section !== "history") {
        expect(render(section)).not.toContain("ACTIVITY");
      }
    }
  });

  it("shows the contract details card and the management card on the overview", () => {
    const markup = render("overview");

    expect(markup).toContain(">Contract details</h2>");
    expect(markup).not.toContain(">Contract parties</h2>");
    // The contract's workspaces, beside the viewer's own workspace access.
    expect(markup).toContain("WORKSPACE MANAGEMENT");
    expect(markup).toContain("WORKSPACES");
  });

  it("marks an archived contract as read-only history, without workspace access", () => {
    vi.mocked(useContractDetails).mockReturnValue({
      ...loadedDetails,
      detail: {
        ...detail,
        contract: { ...detail.contract, deletedAt: "2026-06-01T00:00:00.000Z" },
      },
    } as unknown as ReturnType<typeof useContractDetails>);

    const markup = render("overview");

    expect(markup).toContain("ARCHIVED NOTICE");
    expect(markup).toContain(">Archived</span>");
    // Details and the contract's workspaces stay readable...
    expect(markup).toContain(">Contract details</h2>");
    expect(markup).toContain("WORKSPACE MANAGEMENT");
    // ...but nobody can enter a workspace: every role was revoked.
    expect(markup).not.toContain(">WORKSPACES<");
  });

  it("shows no archived notice on a contract in use", () => {
    expect(render("overview")).not.toContain("ARCHIVED NOTICE");
  });

  it("shows workspace management on the overview only", () => {
    for (const section of ["parties", "history"] as const) {
      expect(render(section), section).not.toContain("WORKSPACE MANAGEMENT");
    }
  });

  it("explains a restricted section opened without permission, instead of an empty page", () => {
    access.value = { roles: false, sites: false, signatories: false };

    for (const section of ["roles", "sites", "signatories"] as const) {
      const markup = render(section);
      expect(markup, section).toContain(
        "This section isn&#x27;t available to you",
      );
      expect(markup, section).toContain(
        'href="/dashboards/contracts/contract-1"',
      );
      expect(markup, section).not.toContain(sectionMarkers[section]);
    }
  });

  it("waits for the permissions before showing a restricted section", () => {
    access.value = {
      roles: undefined,
      sites: undefined,
      signatories: undefined,
    };

    const markup = render("roles");
    expect(markup).toContain("Checking your access…");
    expect(markup).not.toContain("ROLE ASSIGNMENTS");
  });

  it("keeps the existing loading and error states for the contract itself", () => {
    vi.mocked(useContractDetails).mockReturnValue({
      ...loadedDetails,
      detail: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useContractDetails>);
    expect(render("parties")).toContain("Loading contract…");

    vi.mocked(useContractDetails).mockReturnValue({
      ...loadedDetails,
      detail: undefined,
      isLoading: false,
      error: { status: 404, data: { message: "Contract was not found." } },
    } as unknown as ReturnType<typeof useContractDetails>);
    const markup = render("history");
    expect(markup).toContain("Contract was not found.");
    expect(markup).not.toContain('aria-label="Contract sections"');
  });
});

describe("ContractSectionNav", () => {
  const all = { roles: true, sites: true, signatories: true };

  it("links every section to its own URL and marks the current one", () => {
    const markup = renderToStaticMarkup(
      <ContractSectionNav contractId="c-1" current="sites" access={all} />,
    );

    expect(markup).toContain('<nav aria-label="Contract sections"');
    for (const [label, href] of [
      ["Overview", "/dashboards/contracts/c-1"],
      ["Parties", "/dashboards/contracts/c-1/parties"],
      ["Roles", "/dashboards/contracts/c-1/roles"],
      ["Sites", "/dashboards/contracts/c-1/sites"],
      ["Signatories", "/dashboards/contracts/c-1/signatories"],
      ["Documents", "/dashboards/contracts/c-1/documents"],
      ["History", "/dashboards/contracts/c-1/history"],
    ]) {
      expect(markup).toMatch(new RegExp(`href="${href}"[^>]*>${label}</a>`));
    }
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="page"[^>]*>Sites</);
    // The active tab is shown by weight and an underline, not colour alone.
    expect(markup).toMatch(
      /aria-current="page" class="[^"]*border-primary[^"]*font-semibold/,
    );
  });

  it("hides restricted sections the user can't use, or while unknown", () => {
    const markup = renderToStaticMarkup(
      <ContractSectionNav
        contractId="c-1"
        current="overview"
        access={{ roles: false, sites: undefined, signatories: true }}
      />,
    );

    expect(markup).not.toContain(">Roles<");
    expect(markup).not.toContain(">Sites<");
    expect(markup).toContain(">Signatories<");
    expect(markup).toContain(">Parties<");
    expect(markup).toContain(">Documents<");
    expect(markup).toContain(">History<");
  });

  it("keeps the current section listed even when it is restricted", () => {
    const markup = renderToStaticMarkup(
      <ContractSectionNav
        contractId="c-1"
        current="roles"
        access={{ roles: false, sites: false, signatories: false }}
      />,
    );

    expect(markup).toMatch(/aria-current="page"[^>]*>Roles</);
  });
});

describe("contract section URLs", () => {
  it("parses known sections and rejects unknown ones", () => {
    expect(parseContractSection("history")).toBe("history");
    expect(parseContractSection("overview")).toBe("overview");
    expect(parseContractSection("milestones")).toBeNull();
    expect(parseContractSection("History")).toBeNull();
  });

  it("puts the overview at the contract's own URL", () => {
    expect(contractSectionHref("a b", "overview")).toBe(
      "/dashboards/contracts/a%20b",
    );
    expect(contractSectionHref("c-1", "roles")).toBe(
      "/dashboards/contracts/c-1/roles",
    );
  });
});

describe("activity deep links into a contract section", () => {
  beforeEach(() => {
    access.value = { roles: true, sites: true, signatories: true };
    vi.mocked(useContractDetails).mockReturnValue(loadedDetails);
  });

  function renderWith(section: ContractSection, search: string) {
    navigation.params = new URLSearchParams(search);
    return render(section);
  }

  it("gives no target when the URL has no query", () => {
    navigation.params = new URLSearchParams();
    for (const section of ["parties", "roles", "sites", "documents"] as const) {
      expect(render(section)).not.toContain("target=");
    }
  });

  it("hands a valid target, with its version and workspace, to the section that shows the record", () => {
    expect(
      renderWith(
        "documents",
        "targetType=document&targetId=doc-1&targetSection=documents&targetVersionId=v-2",
      ),
    ).toContain("DOCUMENTS target=document:doc-1:documents:v-2:-");
    expect(
      renderWith(
        "roles",
        "targetType=contract_role_assignment&targetId=ra-1&targetSection=roles&targetWorkspace=hse",
      ),
    ).toContain("ROLE ASSIGNMENTS target=contract_role_assignment:ra-1:roles:-:hse");
    expect(
      renderWith(
        "parties",
        "targetType=contract_party_invitation&targetId=inv-1&targetSection=parties",
      ),
    ).toContain("LIFECYCLE invitations target=contract_party_invitation:inv-1:parties:-:-");
    expect(
      renderWith(
        "sites",
        "targetType=contract_site&targetId=site-1&targetSection=sites&page=2",
      ),
    ).toContain("SITES target=contract_site:site-1:sites:-:-");
  });

  it("ignores unknown record types, unknown sections, missing ids and unknown workspaces", () => {
    for (const search of [
      "targetType=invoice&targetId=i-1&targetSection=documents",
      "targetType=document&targetId=doc-1&targetSection=finance",
      "targetType=document&targetSection=documents",
    ]) {
      expect(renderWith("documents", search)).not.toContain("target=");
    }
    expect(
      renderWith(
        "roles",
        "targetType=contract_role_assignment&targetId=ra-1&targetSection=roles&targetWorkspace=payroll",
      ),
    ).toContain("ROLE ASSIGNMENTS target=contract_role_assignment:ra-1:roles:-:-");
  });

  it("follows the URL when its query changes", () => {
    expect(
      renderWith("documents", "targetType=document&targetId=doc-1&targetSection=documents"),
    ).toContain("target=document:doc-1:");
    const next = renderWith(
      "documents",
      "targetType=document&targetId=doc-2&targetSection=documents",
    );
    expect(next).toContain("target=document:doc-2:");
    expect(next).not.toContain("doc-1");
    expect(renderWith("documents", "")).not.toContain("target=");
  });
});
