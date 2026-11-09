import { describe, expect, it } from "vitest";
import { normalizeWebsite, websiteSchema } from "./website";

describe("website validation", () => {
  it.each([
    ["www.greatbuilder.com", "https://www.greatbuilder.com"],
    ["  www.greatbuilder.com  ", "https://www.greatbuilder.com"],
    ["http://www.greatbuilder.com", "http://www.greatbuilder.com"],
  ])("normalizes %j to %j", (value, expected) => {
    expect(websiteSchema.parse(value)).toBe(expected);
  });

  it("allows an empty optional website", () => {
    expect(websiteSchema.parse("")).toBe("");
  });

  it("rejects values without a valid domain", () => {
    expect(websiteSchema.safeParse("not a website").success).toBe(false);
  });

  it("does not add a scheme to an already schemed value", () => {
    expect(normalizeWebsite("https://www.greatbuilder.com")).toBe(
      "https://www.greatbuilder.com",
    );
  });
});
