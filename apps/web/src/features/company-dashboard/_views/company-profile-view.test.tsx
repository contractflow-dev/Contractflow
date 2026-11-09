import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ECompanyStatus,
  ECountryCode,
  ECurrencyCode,
  type ICompanyProfileResponse,
} from "@contractflow/contracts-schema";
import { headingProblems } from "@/components/page-header/heading-outline";
import { CompanyProfileView } from "./company-profile-view";

const company: ICompanyProfileResponse = {
  id: "company-1",
  name: "Acme Works",
  legalName: "Acme Works Limited",
  registrationNumber: "RC-1",
  taxIdentificationNumber: "TIN-1",
  email: "office@acme.example",
  phoneNumber: "+2348000000000",
  website: "",
  addressLine1: "1 Test Road",
  addressLine2: "",
  city: "Lagos",
  stateRegion: "Lagos",
  postalCode: "100001",
  countryCode: ECountryCode.NG,
  defaultCurrencyCode: ECurrencyCode.NGN,
  status: ECompanyStatus.ACTIVE,
  verifiedAt: new Date("2026-01-01T00:00:00Z"),
};

vi.mock("@/features/companies/CompanyAdminShell", () => ({
  CompanyAdminShell: ({
    children,
  }: {
    children: (access: { company: ICompanyProfileResponse }) => ReactNode;
  }) => children({ company }),
}));

vi.mock("@/features/companies", () => ({
  useUpdateCompanyProfileMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock("@/services/companiesApi", () => ({
  useResendCompanyVerificationEmailMutation: () => [
    vi.fn(),
    { isLoading: false },
  ],
}));

describe("CompanyProfileView", () => {
  it("gives the page one <h1>, the page title", () => {
    const markup = renderToStaticMarkup(<CompanyProfileView />);

    expect(markup).toMatch(/<h1[^>]*>Company profile<\/h1>/);
    expect(headingProblems(markup)).toEqual([]);
  });
});
