// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ECompanyStatus,
  ECountryCode,
  ECurrencyCode,
  type ICompanyProfileResponse,
} from "@contractflow/contracts-schema";
import { CompanyProfileView } from "./company-profile-view";

// Typing re-filters ~250 countries in jsdom; allow for a busy parallel run.
vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  company: null as unknown as ICompanyProfileResponse,
  updateProfile: vi.fn(),
}));

vi.mock("@/features/companies/CompanyAdminShell", () => ({
  CompanyAdminShell: ({
    children,
  }: {
    children: (access: { company: ICompanyProfileResponse }) => ReactNode;
  }) => children({ company: mocks.company }),
}));
vi.mock("@/features/companies", () => ({
  useUpdateCompanyProfileMutation: () => [
    mocks.updateProfile,
    { isLoading: false },
  ],
}));
vi.mock("@/services/companiesApi", () => ({
  useResendCompanyVerificationEmailMutation: () => [
    vi.fn(),
    { isLoading: false },
  ],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn() }));

const baseCompany: ICompanyProfileResponse = {
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

const saveButton = () => screen.getByRole("button", { name: "Save changes" });

beforeEach(() => {
  mocks.company = { ...baseCompany };
  mocks.updateProfile.mockReset();
  mocks.updateProfile.mockReturnValue({ unwrap: () => Promise.resolve() });
});
afterEach(cleanup);

describe("Company profile address", () => {
  it("submits the ISO country code and a region of that country", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CompanyProfileView />);

    const country = screen.getByRole("combobox", { name: /Country/ });
    await user.clear(country);
    await user.type(country, "ghana");
    await user.click(screen.getByRole("option", { name: "Ghana" }));

    // The Nigerian state is cleared, and a region of Ghana is required.
    const region = screen.getByRole("combobox", { name: /Region/ });
    expect(region).toHaveProperty("value", "");
    await user.click(saveButton());
    expect(await screen.findByText("Select a region.")).toBeTruthy();
    expect(mocks.updateProfile).not.toHaveBeenCalled();

    await user.type(region, "greater");
    await user.click(screen.getByRole("option", { name: "Greater Accra" }));
    await user.click(saveButton());

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce());
    expect(mocks.updateProfile.mock.calls[0][0]).toMatchObject({
      companyId: "company-1",
      data: { countryCode: "GH", stateRegion: "Greater Accra" },
    });
  });

  it("shows a legacy spelling as the listed state without marking the form changed", () => {
    mocks.company = { ...baseCompany, stateRegion: "Lagos State" };
    render(<CompanyProfileView />);

    expect(screen.getByRole("combobox", { name: /State/ })).toHaveProperty(
      "value",
      "Lagos",
    );
    expect(saveButton()).toHaveProperty("disabled", true);
  });

  it("keeps an unmatched saved region visible and asks for a listed one", async () => {
    const user = userEvent.setup({ delay: null });
    mocks.company = { ...baseCompany, stateRegion: "Old free text" };
    render(<CompanyProfileView />);

    expect(
      screen.getByText(/Previously saved as “Old free text”/),
    ).toBeTruthy();

    await user.type(screen.getByRole("textbox", { name: /Company name/ }), "!");
    await user.click(saveButton());
    expect(
      await screen.findByText("Select a state of the selected country."),
    ).toBeTruthy();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("allows a blank region for a country without supported subdivisions", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CompanyProfileView />);

    const country = screen.getByRole("combobox", { name: /Country/ });
    await user.clear(country);
    await user.type(country, "gibraltar");
    await user.click(screen.getByRole("option", { name: "Gibraltar" }));
    await user.click(saveButton());

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce());
    expect(mocks.updateProfile.mock.calls[0][0].data).toMatchObject({
      countryCode: "GI",
      stateRegion: "",
    });
  });
});

describe("Company profile phone number", () => {
  const phoneInput = () =>
    screen.getByRole("textbox", { name: /Phone number/ });
  const phonePicker = () =>
    screen.getByRole("combobox", { name: /^Phone country code/ });

  it("shows a saved number split into its country and national number", () => {
    render(<CompanyProfileView />);
    expect(phonePicker().getAttribute("aria-label")).toBe(
      "Phone country code: Nigeria +234",
    );
    expect(phoneInput()).toHaveProperty("value", "800 000 0000");
    expect(saveButton()).toHaveProperty("disabled", true);
  });

  it("submits a national number with its trunk prefix in E.164", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CompanyProfileView />);

    await user.clear(phoneInput());
    await user.type(phoneInput(), "0803 123 4567");
    await user.click(saveButton());

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce());
    const { data } = mocks.updateProfile.mock.calls[0][0];
    expect(data.phoneNumber).toBe("+2348031234567");
    expect(data).not.toHaveProperty("phone");
  });

  it("reads a number saved without a calling code in the company's country", async () => {
    const user = userEvent.setup({ delay: null });
    mocks.company = { ...baseCompany, phoneNumber: "08031234567" };
    render(<CompanyProfileView />);

    expect(phoneInput()).toHaveProperty("value", "803 123 4567");
    await user.type(screen.getByRole("textbox", { name: /Company name/ }), "!");
    await user.click(saveButton());

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce());
    expect(mocks.updateProfile.mock.calls[0][0].data.phoneNumber).toBe(
      "+2348031234567",
    );
  });

  it("keeps an unreadable saved number visible and asks for a valid one", async () => {
    const user = userEvent.setup({ delay: null });
    mocks.company = { ...baseCompany, phoneNumber: "0803 1234" };
    render(<CompanyProfileView />);

    expect(phoneInput()).toHaveProperty("value", "0803 1234");
    expect(screen.getByText(/Previously saved as “0803 1234”/)).toBeTruthy();

    await user.type(screen.getByRole("textbox", { name: /Company name/ }), "!");
    await user.click(saveButton());
    expect(
      await screen.findByText("This number is too short for Nigeria."),
    ).toBeTruthy();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("keeps the number when the phone country changes, then revalidates it", async () => {
    const user = userEvent.setup({ delay: null });
    render(<CompanyProfileView />);

    phonePicker().focus();
    await user.keyboard("{Enter}");
    await user.type(
      screen.getByRole("combobox", { name: "Search countries" }),
      "+233",
    );
    await user.keyboard("{Enter}");

    expect(phonePicker().getAttribute("aria-label")).toBe(
      "Phone country code: Ghana +233",
    );
    expect(phoneInput()).toHaveProperty("value", "800 000 0000");
    // The address country is unaffected.
    expect(
      screen.getByRole("combobox", { name: /Country/ }),
    ).toHaveProperty("value", "Nigeria");

    await user.click(saveButton());
    expect(await screen.findByText(/Ghana number|for Ghana/)).toBeTruthy();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });
});
