import { beforeEach, describe, expect, it, vi } from "vitest";

const add = vi.hoisted(() =>
  vi.fn((options?: { id?: string }) => options?.id),
);

vi.mock("@workspace/ui/components/toast", () => ({
  createToastManager: () => ({ add }),
}));

import { notifyError, notifySuccess } from "./notify";

describe("notifySuccess", () => {
  beforeEach(() => add.mockClear());

  it("adds a success toast with a short timeout", () => {
    notifySuccess("Member removed", "Ada Obi no longer has access.");

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Member removed",
        description: "Ada Obi no longer has access.",
        timeout: 5000,
      }),
    );
  });

  it("reuses one id for the same message so repeats don't stack", () => {
    const first = notifySuccess("Workspaces updated");
    const second = notifySuccess("Workspaces updated");
    const other = notifySuccess("Contract details saved");

    expect(first).toBe(second);
    expect(other).not.toBe(first);
  });
});

describe("notifyError", () => {
  beforeEach(() => add.mockClear());

  it("announces errors assertively with the API's message", () => {
    notifyError(
      { status: 403, data: {} },
      "Unable to restore contract.",
      "Restore failed",
    );

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "Restore failed",
        description: "You do not have permission to perform this action.",
        priority: "high",
        timeout: 8000,
      }),
    );
  });

  it("never shows a server error's internal details", () => {
    notifyError(
      { status: 500, data: { message: "QueryFailedError: deadlock" } },
      "Unable to restore contract.",
    );

    const [{ description }] = add.mock.calls[0] as unknown as [
      { description: string },
    ];
    expect(description).not.toContain("deadlock");
    expect(description).toContain("Unable to restore contract.");
  });
});
