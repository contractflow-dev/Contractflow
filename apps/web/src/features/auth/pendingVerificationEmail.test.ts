import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forgetPendingVerificationEmail,
  maskEmail,
  readPendingVerificationEmail,
  rememberPendingVerificationEmail,
} from "./pendingVerificationEmail";

function fakeSessionStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

describe("pending verification email", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is kept for this tab only, normalised, and can be forgotten", () => {
    const sessionStorage = fakeSessionStorage();
    vi.stubGlobal("window", { sessionStorage });

    expect(readPendingVerificationEmail()).toBeNull();
    rememberPendingVerificationEmail("  Ada@Example.COM ");
    expect(readPendingVerificationEmail()).toBe("ada@example.com");
    // Only the address is stored, under one key.
    expect(sessionStorage.length).toBe(1);

    forgetPendingVerificationEmail();
    expect(readPendingVerificationEmail()).toBeNull();
  });

  it("does nothing on the server or when storage is blocked", () => {
    expect(readPendingVerificationEmail()).toBeNull();
    expect(() => rememberPendingVerificationEmail("a@b.co")).not.toThrow();

    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    expect(() => rememberPendingVerificationEmail("a@b.co")).not.toThrow();
    expect(readPendingVerificationEmail()).toBeNull();
  });

  it("masks an address to its first letter and domain", () => {
    expect(maskEmail("ada@example.com")).toBe("a•••@example.com");
    expect(maskEmail("x@y.co")).toBe("x•••@y.co");
    expect(maskEmail("not-an-email")).toBe("•••");
  });
});
