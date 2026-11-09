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
  ContractRoleAssignmentManagement: () => <div>ROLE ASSIGNMENTS</div>,
}));
vi.mock("./contract-lifecycle-management", () => ({
  ContractLifecycleManagement: ({ part }: { part: string }) => (
    <div>LIFECYCLE {part}</div>
  ),
}));
vi.mock("./create-contract-form", () => ({
  CreateContractForm: () => null,
}));
vi.mock("./contract-signatory-management", () => ({
  ContractSignatoryManagement: () => <div>SIGNATORY</div>,
}));
vi.mock("./contract-documents", () => ({
  ContractDocuments: () => <div>DOCUMENTS</div>,
}));
vi.mock("./contract-site-management", () => ({
  ContractSiteManagement: () => <div>SITES</div>,
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

  it("shows the contract details card and the management card on the overview", () => {
    const markup = render("overview");

    expect(markup).toContain(">Contract details</h2>");
    expect(markup).not.toContain(">Contract parties</h2>");
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
