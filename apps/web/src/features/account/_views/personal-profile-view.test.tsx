// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalProfile } from "./personal-profile-view";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  update: vi.fn(),
  saving: false,
  notify: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/services/authApi", () => ({
  useGetCurrentUserQuery: mocks.user,
  useUpdateMyProfileMutation: () => [mocks.update, { isLoading: mocks.saving }],
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: mocks.notify }));
vi.mock("../AccountShell", () => ({ AccountShell: () => null }));

const profile = {
  id: "user-1",
  email: "ada@example.com",
  firstName: "Ada",
  middleName: "",
  lastName: "Obi",
  phoneNumber: "+2348031234567",
  timezone: "UTC",
  status: "active",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  lastLoginAt: null,
  isPlatformAdmin: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mocks.saving = false;
  for (const mock of [mocks.user, mocks.update, mocks.notify, mocks.refetch]) {
    mock.mockReset();
  }
  mocks.user.mockReturnValue({
    data: profile,
    isLoading: false,
    refetch: mocks.refetch,
  });
  mocks.update.mockReturnValue({
    unwrap: () => Promise.resolve({ ...profile }),
  });
});
afterEach(cleanup);

function setup() {
  render(<PersonalProfile fallbackCountry="NG" />);
  return userEvent.setup({ delay: null });
}
const save = () => screen.getByRole("button", { name: "Save Changes" });
const cancel = () => screen.getByRole("button", { name: "Cancel" });
const firstName = () =>
  screen.getByLabelText(/^First name/) as HTMLInputElement;

describe("PersonalProfile", () => {
  it("prefills the profile, with the email read-only and its verification shown", () => {
    setup();
    expect(firstName().value).toBe("Ada");
    expect(
      (screen.getByLabelText(/^Last name/) as HTMLInputElement).value,
    ).toBe("Obi");
    const email = screen.getByLabelText(/^Email/) as HTMLInputElement;
    expect(email.value).toBe("ada@example.com");
    expect(email.readOnly).toBe(true);
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(
      (screen.getByLabelText(/^Time zone/) as HTMLSelectElement).value,
    ).toBe("UTC");
  });

  it("keeps Save and Cancel off until something changes", async () => {
    const user = setup();
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    expect((cancel() as HTMLButtonElement).disabled).toBe(true);
    await user.type(firstName(), "n");
    expect((save() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("You have unsaved changes.")).toBeTruthy();
  });

  it("validates before sending", async () => {
    const user = setup();
    await user.clear(firstName());
    await user.click(save());
    expect(await screen.findByText("Enter your first name.")).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("sends only the fields that changed, then says so", async () => {
    const user = setup();
    await user.clear(firstName());
    await user.type(firstName(), "Adaeze");
    await user.click(save());

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({ firstName: "Adaeze" }),
    );
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith("Profile updated"),
    );
    // Saved: nothing is unsaved any more.
    await waitFor(() =>
      expect((save() as HTMLButtonElement).disabled).toBe(true),
    );
  });

  it("keeps what was typed and shows the API's reason when saving fails", async () => {
    mocks.update.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 400,
          data: { message: "timezone must be a valid IANA time-zone" },
        }),
    });
    const user = setup();
    await user.type(firstName(), "x");
    await user.click(save());

    const form = screen.getByRole("form", { name: "Personal profile" });
    expect(
      await within(form).findByText("timezone must be a valid IANA time-zone"),
    ).toBeTruthy();
    expect(firstName().value).toBe("Adax");
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("puts every field back on Cancel", async () => {
    const user = setup();
    await user.type(firstName(), "xyz");
    await user.click(cancel());
    expect(firstName().value).toBe("Ada");
    expect(screen.queryByText("You have unsaved changes.")).toBeNull();
  });

  it("warns before leaving the page with unsaved changes", async () => {
    const user = setup();
    const unsaved = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unsaved()).toBe(false);
    await user.type(firstName(), "x");
    expect(unsaved()).toBe(true);
  });

  it("shows loading, then an error with Retry", async () => {
    mocks.user.mockReturnValue({ isLoading: true, refetch: mocks.refetch });
    setup();
    expect(
      screen.getByRole("status", { name: "Loading your profile" }),
    ).toBeTruthy();
    cleanup();

    mocks.user.mockReturnValue({
      isLoading: false,
      error: { status: 500, data: {} },
      refetch: mocks.refetch,
    });
    const user = setup();
    expect(screen.getByText(/could not be loaded/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
