import { describe, expect, it, vi } from "vitest";
import { completeSignOut } from "./signOut";

describe("completeSignOut", () => {
  it("clears local state before redirecting after successful server logout", async () => {
    const calls: string[] = [];
    const request = vi.fn().mockResolvedValue({ success: true });

    await completeSignOut(
      request,
      () => calls.push("clear"),
      (href) => calls.push(href),
    );

    expect(request).toHaveBeenCalledOnce();
    expect(calls).toEqual(["clear", "/login"]);
  });

  it("clears local state and redirects with a warning when server logout fails", async () => {
    const calls: string[] = [];
    const request = vi.fn().mockRejectedValue(new Error("network unavailable"));

    await completeSignOut(
      request,
      () => calls.push("clear"),
      (href) => calls.push(href),
    );

    expect(request).toHaveBeenCalledOnce();
    expect(calls).toEqual(["clear", "/login?logout=failed"]);
  });
});
