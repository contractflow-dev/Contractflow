// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountrySelect } from "./country-select";
import { StateRegionSelect } from "./state-region-select";
import { CountryRegionFields } from "./country-region-fields";

// Typing re-filters ~250 countries in jsdom; allow for a busy parallel run.
vi.setConfig({ testTimeout: 20_000 });
afterEach(cleanup);

function ControlledCountry({
  initial = "",
  clearable = false,
  onChange = () => {},
}: {
  initial?: string;
  clearable?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="country">Country</label>
      <CountrySelect
        id="country"
        value={value}
        clearable={clearable}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </>
  );
}

function Fields({
  initialCountry = "",
  initialRegion = "",
}: {
  initialCountry?: string;
  initialRegion?: string;
}) {
  const [countryCode, setCountryCode] = useState(initialCountry);
  const [stateRegion, setStateRegion] = useState(initialRegion);
  return (
    <form aria-label="Address">
      <CountryRegionFields
        countryId="country"
        stateRegionId="region"
        countryName="countryCode"
        stateRegionName="stateRegion"
        countryCode={countryCode}
        stateRegion={stateRegion}
        onCountryCodeChange={setCountryCode}
        onStateRegionChange={setStateRegion}
      />
      <output data-testid="values">{`${countryCode}|${stateRegion}`}</output>
    </form>
  );
}

const optionNames = () =>
  within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((option) => option.textContent);

const values = () => screen.getByTestId("values").textContent;

describe("CountrySelect", () => {
  it("lists countries alphabetically and filters them by search", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ControlledCountry />);

    const input = screen.getByRole("combobox", { name: "Country" });
    expect(input).toHaveProperty("placeholder", "Select country");

    await user.click(input);
    const all = optionNames();
    expect(all.length).toBeGreaterThan(200);
    expect(all.slice(0, 2)).toEqual(["Afghanistan", "Åland Islands"]);

    await user.type(input, "nig");
    expect(optionNames()).toEqual(["Niger", "Nigeria"]);
  });

  it("finds a country by its ISO code and ignores accents", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ControlledCountry />);
    const input = screen.getByRole("combobox", { name: "Country" });

    await user.type(input, "aland is");
    expect(optionNames()).toEqual(["Åland Islands"]);

    await user.clear(input);
    await user.type(input, "GB");
    expect(optionNames()).toContain("United Kingdom");
  });

  it("returns the ISO code of the selected country", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<ControlledCountry onChange={onChange} />);

    await user.type(
      screen.getByRole("combobox", { name: "Country" }),
      "nigeria",
    );
    await user.click(screen.getByRole("option", { name: "Nigeria" }));

    expect(onChange).toHaveBeenLastCalledWith("NG");
    expect(screen.getByRole("combobox", { name: "Country" })).toHaveProperty(
      "value",
      "Nigeria",
    );
  });

  it("can be operated with the keyboard alone", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<ControlledCountry onChange={onChange} />);

    await user.tab();
    const input = screen.getByRole("combobox", { name: "Country" });
    expect(document.activeElement).toBe(input);

    // The first match is highlighted; ArrowDown moves to the next one.
    await user.keyboard("nig");
    expect(optionNames()).toEqual(["Niger", "Nigeria"]);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("NG");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows an empty state when the search matches nothing", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ControlledCountry />);

    await user.type(screen.getByRole("combobox", { name: "Country" }), "zzzz");

    expect(screen.getByText("No countries match your search.")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("clears the selection when clearing is allowed", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<ControlledCountry initial="NG" clearable onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(onChange).toHaveBeenLastCalledWith("");
    expect(
      screen.queryByRole("button", { name: "Clear selection" }),
    ).toBeNull();
  });
});

describe("StateRegionSelect", () => {
  it("is disabled until a country is selected", () => {
    render(
      <StateRegionSelect
        id="region"
        aria-label="State"
        countryCode=""
        value=""
        onValueChange={() => {}}
      />,
    );

    const input = screen.getByRole("combobox", { name: "State" });
    expect(input).toHaveProperty("disabled", true);
    expect(input).toHaveProperty("placeholder", "Select a country first");
  });

  it("lists and searches only the selected country's subdivisions", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Fields initialCountry="NG" />);

    const state = screen.getByRole("combobox", { name: /State/ });
    expect(state).toHaveProperty("placeholder", "Select state");

    await user.click(state);
    const nigeria = optionNames();
    expect(nigeria).toHaveLength(37);
    expect(nigeria).toEqual(
      expect.arrayContaining([
        "Bayelsa",
        "Rivers",
        "Lagos",
        "Federal Capital Territory",
      ]),
    );
    expect(nigeria).not.toContain("California");

    await user.type(state, "riv");
    expect(optionNames()).toEqual(["Cross River", "Rivers"]);

    await user.click(screen.getByRole("option", { name: "Rivers" }));
    expect(values()).toBe("NG|Rivers");
  });

  it("shows a free-text field for a country without supported subdivisions", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Fields initialCountry="GI" />);

    const region = screen.getByRole("textbox", { name: /State or region/ });
    expect(screen.getByText("Optional")).toBeTruthy();

    await user.type(region, "Upper Town");
    expect(values()).toBe("GI|Upper Town");
  });

  it("does not show a saved region that belongs to another country", () => {
    render(<Fields initialCountry="US" initialRegion="Lagos" />);

    expect(screen.getByRole("combobox", { name: /State/ })).toHaveProperty(
      "value",
      "",
    );
    expect(screen.getByText(/Previously saved as “Lagos”/)).toBeTruthy();
  });
});

describe("CountryRegionFields", () => {
  it("clears the region when the country changes", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Fields initialCountry="NG" initialRegion="Lagos" />);

    expect(screen.getByRole("combobox", { name: /State/ })).toHaveProperty(
      "value",
      "Lagos",
    );

    const country = screen.getByRole("combobox", { name: /Country/ });
    await user.clear(country);
    await user.type(country, "ghana");
    await user.click(screen.getByRole("option", { name: "Ghana" }));

    expect(values()).toBe("GH|");
    const region = screen.getByRole("combobox", { name: /Region/ });
    expect(region).toHaveProperty("value", "");

    await user.click(region);
    expect(optionNames()).not.toContain("Lagos");
    expect(optionNames()).toContain("Greater Accra");
  });

  it("submits the ISO code and region name in native form data", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Fields initialCountry="CA" initialRegion="Ontario" />);

    const form = screen.getByRole("form", {
      name: "Address",
    }) as HTMLFormElement;
    let data = new FormData(form);
    expect(data.get("countryCode")).toBe("CA");
    expect(data.get("stateRegion")).toBe("Ontario");

    const region = screen.getByRole("combobox", { name: /Province/ });
    await user.clear(region);
    await user.type(region, "yuk");
    await user.keyboard("{Enter}");

    data = new FormData(form);
    expect(data.get("stateRegion")).toBe("Yukon");
  });
});
