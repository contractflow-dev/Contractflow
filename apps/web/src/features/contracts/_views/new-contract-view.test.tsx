// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewContractView } from "./new-contract-view";

vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  canManageCompany: true,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock("@/features/companies/CompanyAdminShell", () => ({
  CompanyAdminShell: ({
    children,
  }: {
    children: (access: unknown) => ReactNode;
  }) =>
    children({
      company: { id: "company-1", name: "Acme" },
      membership: { id: "m-1", canManageCompany: mocks.canManageCompany },
    }),
}));
vi.mock("@/services/contractApi", () => ({
  useGetContractsQuery: () => ({
    currentData: { data: [] },
    isFetching: false,
    error: undefined,
  }),
  useCreateContractMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn() }));

beforeEach(() => {
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.canManageCompany = true;
});
afterEach(cleanup);

function setup() {
  const user = userEvent.setup({ delay: null });
  render(<NewContractView />);
  return user;
}

const backLink = () => screen.getByRole("link", { name: "Back to contracts" });
const cancel = () => screen.getByRole("button", { name: "Cancel" });

describe("NewContractView", () => {
  it("is a page with its own heading and the four-step form, not a dialog", () => {
    setup();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "New contract",
    ]);
    expect(backLink().getAttribute("href")).toBe("/dashboards/contracts");
    expect(
      screen.getByRole("form", { name: "New draft contract" }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("list", { name: "Steps" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(4);
    // The step list names the current step.
    expect(
      screen
        .getByRole("list", { name: "Steps" })
        .querySelector('[aria-current="step"]')?.textContent,
    ).toContain("Basics");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("tells a member who isn't a Company Administrator that they can't create one", () => {
    mocks.canManageCompany = false;
    setup();

    expect(
      screen.getByText(/Only Company Administrators can create contracts/),
    ).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    expect(backLink().getAttribute("href")).toBe("/dashboards/contracts");
  });

  it("returns to the register on Cancel when nothing has been entered", async () => {
    const user = setup();

    await user.click(cancel());

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.push).toHaveBeenCalledWith("/dashboards/contracts");
  });

  it("asks before Cancel discards what's been entered, and keeps it if the user stays", async () => {
    const user = setup();
    const reference = screen.getByLabelText(/Reference number/);
    await user.type(reference, "CTR-100");

    await user.click(cancel());
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("Discard this contract?")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText(/Reference number/) as HTMLInputElement).value,
    ).toBe("CTR-100");

    await user.click(cancel());
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Discard and leave",
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/dashboards/contracts");
  });

  it("asks before the Back to contracts link discards what's been entered", async () => {
    const user = setup();
    await user.type(screen.getByLabelText(/Contract title/), "Jetty repairs");

    await user.click(backLink());

    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("warns before a reload or closed tab only once something has been entered", async () => {
    const user = setup();
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);
    await user.type(screen.getByLabelText(/Contract title/), "Jetty repairs");
    expect(unload()).toBe(true);
  });
});
