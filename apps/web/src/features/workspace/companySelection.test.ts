import { describe, expect, it } from "vitest";
import {
  activeCompanyStorageKey,
  persistActiveCompanyId,
  readPersistedActiveCompanyId,
  resolveActiveCompanyId,
} from "./companySelection";

describe("resolveActiveCompanyId", () => {
  const availableCompanyIds = ["company-a", "company-b"];

  it("keeps a valid in-memory selection", () => {
    expect(
      resolveActiveCompanyId(availableCompanyIds, "company-b", "company-a"),
    ).toBe("company-b");
  });

  it("restores a persisted selection when the in-memory state is empty", () => {
    expect(resolveActiveCompanyId(availableCompanyIds, null, "company-b")).toBe(
      "company-b",
    );
  });

  it("falls back safely when the stored selection is no longer available", () => {
    expect(
      resolveActiveCompanyId(
        availableCompanyIds,
        "suspended-company",
        "deleted-company",
      ),
    ).toBe("company-a");
  });

  it("returns no selection when the user has no available companies", () => {
    expect(resolveActiveCompanyId([], null, "company-a")).toBeNull();
  });

  it("restores a user-scoped selection after a fresh application state", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    persistActiveCompanyId(storage, "user-a", "company-b");

    expect(activeCompanyStorageKey("user-a")).not.toBe(
      activeCompanyStorageKey("user-b"),
    );
    expect(
      resolveActiveCompanyId(
        availableCompanyIds,
        null,
        readPersistedActiveCompanyId(storage, "user-a"),
      ),
    ).toBe("company-b");
  });
});
