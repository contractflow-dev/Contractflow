// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingView } from "./onboarding-view";

// jsdom typing is slow under a busy parallel run.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: () => ({
    data: {
      id: "u-1",
      email: "ada@example.com",
      emailVerifiedAt: "2026-01-01",
    },
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/features/companies", () => ({
  useCreateCompanyMutation: () => [vi.fn(), { isLoading: false }],
  useGetCompanyAccessSummaryQuery: () => ({ data: undefined }),
}));
vi.mock("@/store/hooks", () => ({ useAppDispatch: () => vi.fn() }));
vi.mock("@/components/auth/auth-hero", () => ({ AuthHero: () => null }));
vi.mock("@/components/auth/authTopBar", () => ({ AuthTopBar: () => null }));
vi.mock("@/components/auth/sign-out-action", () => ({
  SignOutAction: () => null,
}));

afterEach(cleanup);

const heading = () => screen.getByRole("heading", { level: 2 });
const stepItem = (title: string) =>
  screen.getByText(title, { selector: "li span" }).closest("li")!;

describe("Create your company steps", () => {
  it("names each step in a focusable heading", () => {
    render(<OnboardingView />);
    expect(heading().textContent).toBe(
      "Step 1 of 3: Company and legal details",
    );
    expect(heading().getAttribute("tabindex")).toBe("-1");
    expect(
      stepItem("Company and legal details").getAttribute("aria-current"),
    ).toBe("step");
  });

  it("keeps an invalid step open and focuses its first invalid field", async () => {
    const user = userEvent.setup({ delay: null });
    render(<OnboardingView />);
    await user.type(screen.getByLabelText(/Legal name/), "Ada Works Ltd");
    await user.click(screen.getByRole("button", { name: "Next: Contact" }));

    expect(await screen.findByText("Company name is required")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/Company name/));
    expect(stepItem("Company and legal details").dataset.status).toBe(
      "current",
    );
  });

  it("checks off a valid step on Enter, focuses the next one, and keeps values on Back", async () => {
    const user = userEvent.setup({ delay: null });
    render(<OnboardingView />);
    await user.type(screen.getByLabelText(/Company name/), "Ada Works");
    await user.type(
      screen.getByLabelText(/Legal name/),
      "Ada Works Ltd{Enter}",
    );

    await waitFor(() =>
      expect(heading().textContent).toBe("Step 2 of 3: Contact"),
    );
    await waitFor(() => expect(document.activeElement).toBe(heading()));
    const done = stepItem("Company and legal details");
    expect(done.dataset.status).toBe("completed");
    expect(done.querySelector("[data-slot=step-completed-icon]")).toBeTruthy();
    expect(stepItem("Contact").dataset.status).toBe("current");
    expect(stepItem("Address and currency").dataset.status).toBe("upcoming");
    // Contact's own fields weren't checked on the way in.
    expect(screen.queryByText("Enter a valid company email")).toBeNull();

    // Contact is now checked on its own.
    await user.click(screen.getByRole("button", { name: /^Next:/ }));
    expect(await screen.findByText("Enter a valid company email")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/Company email/));

    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(heading().textContent).toContain("Company and"));
    expect(screen.getByLabelText(/Company name/)).toHaveProperty(
      "value",
      "Ada Works",
    );
    expect(stepItem("Company and legal details").textContent).toContain(
      "(completed)",
    );
  });
});
