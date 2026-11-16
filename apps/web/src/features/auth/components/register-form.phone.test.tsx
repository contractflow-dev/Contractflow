// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "./register-form";

// jsdom has no PointerEvent, which Base UI's checkbox creates on click.
window.PointerEvent ??= MouseEvent as unknown as typeof PointerEvent;

// Typing re-filters ~240 countries in jsdom; allow for a busy parallel run.
vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({ register: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/services/authApi", () => ({
  useRegisterMutation: () => [mocks.register, { isLoading: false }],
}));
vi.mock("@/services/companiesApi", () => ({
  useGetPublicCompanyInvitationQuery: () => ({
    currentData: undefined,
    isError: false,
  }),
}));

beforeEach(() => {
  mocks.register.mockReset();
  mocks.register.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});
afterEach(cleanup);

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: /First name/ }), "Ada");
  await user.type(screen.getByRole("textbox", { name: /Last name/ }), "Obi");
  await user.type(
    screen.getByRole("textbox", { name: /Email/ }),
    "ada@example.com",
  );
  for (const field of document.querySelectorAll<HTMLInputElement>(
    "#password, #confirmPassword",
  )) {
    await user.type(field, "Correct-Horse-9!");
  }
  await user.click(
    screen.getByRole("checkbox", { name: /I agree to the Terms/ }),
  );
}

const submit = () => screen.getByRole("button", { name: "Continue" });

describe("RegisterForm phone number", () => {
  it("starts without a preselected country", () => {
    render(<RegisterForm />);
    expect(
      screen
        .getByRole("combobox", { name: /^Phone country code/ })
        .getAttribute("aria-label"),
    ).toBe("Phone country code: not selected");
  });

  it("registers without a phone number", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);
    await fillRequiredFields(user);
    await user.click(submit());

    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    expect(mocks.register.mock.calls[0][0].phoneNumber).toBe("");
  });

  it("sends the chosen country's number in E.164", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);
    await fillRequiredFields(user);

    screen.getByRole("combobox", { name: /^Phone country code/ }).focus();
    await user.keyboard("{Enter}");
    await user.type(
      screen.getByRole("combobox", { name: "Search countries" }),
      "nigeria",
    );
    await user.keyboard("{Enter}");
    await user.type(
      screen.getByRole("textbox", { name: /Phone number/ }),
      "0803 123 4567",
    );
    await user.click(submit());

    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    expect(mocks.register.mock.calls[0][0].phoneNumber).toBe("+2348031234567");
  });

  it("blocks a number without a country", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RegisterForm />);
    await fillRequiredFields(user);
    await user.type(
      screen.getByRole("textbox", { name: /Phone number/ }),
      "0803 123 4567",
    );
    await user.click(submit());

    expect(
      await screen.findByText("Select the country for this number."),
    ).toBeTruthy();
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
