import { describe, expect, it } from "vitest";
import { activeNavChild } from "@/components/app-shell/navigation";
import { ACCOUNT_NAVIGATION, ACCOUNT_PROFILE_PATH } from "./account-navigation";

const items = ACCOUNT_NAVIGATION.flatMap(({ items }) => items);

describe("account navigation", () => {
  it("lists only built personal pages", () => {
    expect(
      ACCOUNT_NAVIGATION.map(({ label, items: pages }) => [
        label,
        pages.map(({ label: name }) => name),
      ]),
    ).toEqual([["My Account", ["Personal Profile"]]]);
  });

  it("keeps personal settings outside the company workspace", () => {
    for (const { href } of items) {
      expect(href.startsWith("/account/"), href).toBe(true);
      expect(href.startsWith("/dashboards"), href).toBe(false);
    }
  });

  it("marks Personal Profile as the open page", () => {
    expect(activeNavChild(ACCOUNT_PROFILE_PATH, items)?.label).toBe(
      "Personal Profile",
    );
  });

  it("includes no company administration", () => {
    const labels = items.map(({ label }) => label.toLowerCase());
    for (const word of ["company", "team", "invitation", "document"]) {
      expect(
        labels.some((label) => label.includes(word)),
        word,
      ).toBe(false);
    }
  });
});
