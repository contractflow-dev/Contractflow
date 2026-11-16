import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ESubdivisionType,
  findCountrySubdivision,
  getCountrySubdivisions,
  getSubdivisionLabel,
  hasCountrySubdivisions,
} from "@contractflow/contracts-schema/geography";
import { countryCodes } from "@/lib/countries";
import {
  normalizeStateRegion,
  refineStateRegion,
  stateRegionError,
} from "./address";

const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const names = (countryCode: string) =>
  getCountrySubdivisions(countryCode).map((subdivision) => subdivision.name);

describe("country subdivisions", () => {
  it("lists Nigeria's 36 states and the Federal Capital Territory", () => {
    const nigeria = getCountrySubdivisions("NG");
    const states = nigeria.filter(
      (subdivision) => subdivision.type === ESubdivisionType.STATE,
    );

    expect(nigeria).toHaveLength(37);
    expect(states.map((state) => state.name).sort()).toEqual(
      [...NIGERIAN_STATES].sort(),
    );
    expect(names("NG")).toEqual(
      expect.arrayContaining(["Bayelsa", "Rivers", "Lagos"]),
    );
  });

  it("classifies the Federal Capital Territory separately from the states", () => {
    expect(findCountrySubdivision("NG", "FC")).toEqual({
      countryCode: "NG",
      code: "FC",
      name: "Federal Capital Territory",
      type: ESubdivisionType.FEDERAL_CAPITAL_TERRITORY,
    });
    expect(findCountrySubdivision("NG", "Abuja")?.code).toBe("FC");
  });

  it("lists the 50 US states and the District of Columbia only", () => {
    const us = getCountrySubdivisions("US");
    expect(us).toHaveLength(51);
    expect(
      us.filter((subdivision) => subdivision.type === ESubdivisionType.STATE),
    ).toHaveLength(50);
    expect(findCountrySubdivision("US", "DC")?.type).toBe(
      ESubdivisionType.FEDERAL_DISTRICT,
    );
    // Territories have their own country codes.
    expect(findCountrySubdivision("US", "Puerto Rico")).toBeNull();
  });

  it("distinguishes provinces from territories in Canada and Australia", () => {
    const canada = getCountrySubdivisions("CA");
    expect(canada).toHaveLength(13);
    expect(
      canada
        .filter((s) => s.type === ESubdivisionType.TERRITORY)
        .map((s) => s.name),
    ).toEqual(["Northwest Territories", "Nunavut", "Yukon"]);

    const australia = getCountrySubdivisions("AU");
    expect(australia).toHaveLength(8);
    expect(findCountrySubdivision("AU", "ACT")?.type).toBe(
      ESubdivisionType.TERRITORY,
    );
    expect(findCountrySubdivision("AU", "NSW")?.type).toBe(
      ESubdivisionType.STATE,
    );
  });

  it("includes subdivisions from all four UK nations", () => {
    expect(names("GB")).toEqual(
      expect.arrayContaining([
        "Kent",
        "Aberdeen City",
        "Cardiff",
        "Belfast City",
      ]),
    );
  });

  it("sorts each country's subdivisions alphabetically", () => {
    const list = names("NG");
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("uses a country-specific label where one is known", () => {
    expect(getSubdivisionLabel("NG")).toBe("State");
    expect(getSubdivisionLabel("CA")).toBe("Province or territory");
    expect(getSubdivisionLabel("FR")).toBe("State or region");
    expect(getSubdivisionLabel("")).toBe("State or region");
  });

  it("treats countries without supported subdivisions as having none", () => {
    // Svalbard is not in the dataset; Gibraltar lists only itself.
    expect(hasCountrySubdivisions("SJ")).toBe(false);
    expect(hasCountrySubdivisions("GI")).toBe(false);
    expect(getCountrySubdivisions("")).toEqual([]);
  });

  it("never matches a subdivision of another country", () => {
    expect(findCountrySubdivision("US", "Lagos")).toBeNull();
    expect(findCountrySubdivision("NG", "California")).toBeNull();
    expect(findCountrySubdivision("NG", "US-CA")).toBeNull();
  });

  it("does not throw for any selectable country", () => {
    for (const code of countryCodes) {
      expect(() => getCountrySubdivisions(code)).not.toThrow();
    }
  });
});

describe("address form helpers", () => {
  const schema = z
    .object({ countryCode: z.string(), stateRegion: z.string() })
    .superRefine(refineStateRegion);
  const regionIssues = (countryCode: string, stateRegion: string) =>
    schema
      .safeParse({ countryCode, stateRegion })
      .error?.issues.filter((issue) => issue.path[0] === "stateRegion")
      .map((issue) => issue.message) ?? [];

  it("requires a region when the country has supported subdivisions", () => {
    expect(regionIssues("NG", "")).toEqual(["Select a state."]);
    expect(regionIssues("NG", "Rivers")).toEqual([]);
  });

  it("rejects a region from another country", () => {
    expect(regionIssues("GH", "Rivers")).toEqual([
      "Select a region of the selected country.",
    ]);
  });

  it("allows a blank region where no subdivisions are supported", () => {
    expect(regionIssues("GI", "")).toEqual([]);
    expect(stateRegionError("SJ", "Longyearbyen")).toBeUndefined();
  });

  it("leaves the region error to the country field when no country is set", () => {
    expect(regionIssues("", "")).toEqual([]);
  });

  it("maps legacy spellings to the listed subdivision", () => {
    expect(normalizeStateRegion("NG", "Lagos State")).toBe("Lagos");
    expect(normalizeStateRegion("NG", "FCT")).toBe("Federal Capital Territory");
    expect(normalizeStateRegion("NG", "Unknown place")).toBe("Unknown place");
  });
});
