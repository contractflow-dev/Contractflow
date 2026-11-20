// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateContractWizard } from "./create-contract-form";

vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  createContract: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/services/contractApi", () => ({
  useGetContractsQuery: () => ({
    currentData: { data: [] },
    isFetching: false,
    error: undefined,
  }),
  useCreateContractMutation: () => [
    mocks.createContract,
    { isLoading: false, error: undefined },
  ],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn() }));

beforeEach(() => {
  mocks.createContract.mockReset();
  mocks.createContract.mockResolvedValue({ data: { id: "contract-9" } });
  mocks.replace.mockReset();
});
afterEach(cleanup);

function setup() {
  const user = userEvent.setup({ delay: null });
  render(
    <CreateContractWizard
      formId="new-contract"
      companyId="company-1"
      onCancel={() => undefined}
    />,
  );
  return user;
}

// The step list names the current step; the step heading it once
// repeated is empty, kept only as where focus goes between steps.
const currentStep = () =>
  screen
    .getByRole("list", { name: "Steps" })
    .querySelector<HTMLElement>('[aria-current="step"]')!;
const stepFocusTarget = () =>
  document.querySelector<HTMLElement>('h2[tabindex="-1"]')!;
const stepItem = (title: string) =>
  screen.getByText(title, { selector: "li span" }).closest("li")!;

async function next(user: ReturnType<typeof userEvent.setup>, to: string) {
  await user.click(screen.getByRole("button", { name: /^Next:/ }));
  await waitFor(() => expect(currentStep().textContent).toContain(to));
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Reference number/), "CTR-100");
  await user.type(screen.getByLabelText(/Contract title/), "Jetty repairs");
}

describe("CreateContractWizard steps", () => {
  it("validates only Basics on Next, and focuses its first invalid field", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /^Next:/ }));

    expect(await screen.findByText("Enter a reference number.")).toBeTruthy();
    expect(currentStep().textContent).toContain("Basics");
    expect(document.activeElement).toBe(
      screen.getByLabelText(/Reference number/),
    );
    expect(stepItem("Basics").dataset.status).toBe("current");
  });

  it("marks Basics completed with a check after Next, and focuses the next step", async () => {
    const user = setup();
    await fillBasics(user);
    await next(user, "Parties & workspaces");

    await waitFor(() => expect(document.activeElement).toBe(stepFocusTarget()));
    expect(stepItem("Basics").dataset.status).toBe("completed");
    expect(
      stepItem("Basics").querySelector("[data-slot=step-completed-icon]"),
    ).toBeTruthy();
    expect(stepItem("Parties & workspaces").dataset.status).toBe("current");
    for (const title of ["Commercial terms", "Dates"]) {
      expect(stepItem(title).dataset.status).toBe("upcoming");
    }
  });

  it("keeps a newline typed in the description, and Back keeps every value", async () => {
    const user = setup();
    await fillBasics(user);
    await user.type(
      screen.getByLabelText(/Description/),
      "Phase 1{Enter}Phase 2",
    );
    expect(currentStep().textContent).toContain("Basics");

    await next(user, "Parties & workspaces");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(currentStep().textContent).toContain("Basics"));

    expect(screen.getByLabelText(/Reference number/)).toHaveProperty(
      "value",
      "CTR-100",
    );
    expect(screen.getByLabelText(/Description/)).toHaveProperty(
      "value",
      "Phase 1\nPhase 2",
    );
  });

  it("removes Basics' check when a required value is cleared", async () => {
    const user = setup();
    await fillBasics(user);
    await next(user, "Parties & workspaces");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(currentStep().textContent).toContain("Basics"));
    expect(stepItem("Basics").textContent).toContain("(completed)");

    await user.clear(screen.getByLabelText(/Contract title/));
    expect(stepItem("Basics").textContent).not.toContain("(completed)");
    // Next can't move past it now.
    await user.click(screen.getByRole("button", { name: /^Next:/ }));
    expect(await screen.findByText("Enter a contract title.")).toBeTruthy();
    expect(currentStep().textContent).toContain("Basics");
  });

  it("moves on with Enter, checks the dates on create, then creates once", async () => {
    const user = setup();
    await fillBasics(user);
    await user.type(screen.getByLabelText(/Contract title/), "{Enter}");
    await waitFor(() => expect(currentStep().textContent).toContain("Parties"));
    await next(user, "Commercial terms");
    await user.type(
      screen.getByLabelText(/Original contract value/),
      "1500{Enter}",
    );
    await waitFor(() => expect(currentStep().textContent).toContain("Dates"));
    expect(stepItem("Commercial terms").dataset.status).toBe("completed");

    // The last step is checked as a whole form.
    await user.click(
      screen.getByRole("button", { name: "Create draft contract" }),
    );
    expect(await screen.findByText("Enter the award date.")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText(/Award date/)),
    );
    expect(mocks.createContract).not.toHaveBeenCalled();

    for (const [label, value] of [
      [/Award date/, "2026-01-05"],
      [/Start date/, "2026-02-01"],
      [/^End date/, "2026-12-31"],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const create = screen.getByRole("button", {
      name: "Create draft contract",
    });
    await user.click(create);
    // The form's page is replaced in history by the new contract.
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        "/dashboards/contracts/contract-9",
      ),
    );
    expect(mocks.createContract).toHaveBeenCalledTimes(1);
    expect(mocks.createContract.mock.lastCall?.[0]).toMatchObject({
      companyId: "company-1",
      // NGN 1,500.00, sent as a string of kobo.
      body: {
        referenceNumber: "CTR-100",
        title: "Jetty repairs",
        originalValueMinor: "150000",
      },
    });
    expect(stepItem("Dates").textContent).toContain("(completed)");
  });
});
