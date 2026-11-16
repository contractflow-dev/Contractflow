// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EMPTY_PHONE,
  phoneFieldFromSaved,
  phoneFieldSchema,
  phoneNumberError,
  phoneToE164,
  type PhoneFieldValue,
} from "@/lib/phone";
import { FormField } from "./form-field";
import {
  PhoneNumberInput,
  phoneCountryMatchesSearch,
  phoneCountryOptions,
} from "./phone-number-input";

// Typing re-filters ~240 countries in jsdom; allow for a busy parallel run.
vi.setConfig({ testTimeout: 20_000 });
afterEach(cleanup);

function Phone({
  initial = EMPTY_PHONE,
  required = false,
}: {
  initial?: PhoneFieldValue;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const error = touched ? phoneNumberError(value, { required }) : undefined;
  return (
    <form aria-label="Contact">
      <FormField
        id="phone"
        label="Phone number"
        error={error}
        required={required}
      >
        {(control) => (
          <PhoneNumberInput
            {...control}
            value={value}
            onValueChange={setValue}
            onBlur={() => setTouched(true)}
          />
        )}
      </FormField>
      <output data-testid="value">{`${value.countryCode}|${value.nationalNumber}`}</output>
    </form>
  );
}

const option = (code: string) =>
  phoneCountryOptions.find((candidate) => candidate.code === code)!;

const visibleOptions = () =>
  within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((item) => item.textContent);

const picker = () =>
  screen.getByRole("combobox", { name: /^Phone country code/ });
const numberInput = () => screen.getByRole("textbox", { name: /Phone number/ });
const value = () => screen.getByTestId("value").textContent;

/** Opens the country picker from the keyboard, as a keyboard user would. */
async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  picker().focus();
  await user.keyboard("{Enter}");
  return screen.getByRole("combobox", { name: "Search countries" });
}

describe("phone country options", () => {
  it("pairs each country with its calling code", () => {
    expect(option("NG")).toEqual({
      code: "NG",
      name: "Nigeria",
      callingCode: "234",
    });
    expect(option("GB").callingCode).toBe("44");
    expect(option("GH").callingCode).toBe("233");
    expect(option("ZA").callingCode).toBe("27");
    expect(option("AE").callingCode).toBe("971");
  });

  it("lists countries sharing a calling code as separate options", () => {
    const plusOne = phoneCountryOptions.filter((o) => o.callingCode === "1");
    expect(plusOne.map((o) => o.code)).toEqual(
      expect.arrayContaining(["US", "CA", "JM", "PR"]),
    );
  });

  it.each([
    ["Nigeria", "NG", true],
    ["nig", "NG", true],
    ["NG", "NG", true],
    ["+234", "NG", true],
    ["234", "NG", true],
    ["00234", "NG", true],
    ["+44", "NG", false],
    ["+1", "CA", true],
    ["+1", "US", true],
    ["united kingdom", "GB", true],
    ["côte", "CI", true],
  ])("matches %j against %s: %s", (query, code, expected) => {
    expect(phoneCountryMatchesSearch(option(code), query)).toBe(expected);
  });
});

describe("PhoneNumberInput", () => {
  it("labels the number input and names the country picker", async () => {
    render(<Phone />);
    expect(numberInput()).toHaveProperty("type", "tel");
    expect(numberInput().getAttribute("autocomplete")).toBe("tel-national");
    expect(picker().getAttribute("aria-label")).toBe(
      "Phone country code: not selected",
    );
    expect(picker().textContent).toContain("Code");
  });

  it("shows the selected country's flag and calling code", async () => {
    const { container } = render(
      <Phone initial={{ countryCode: "NG", nationalNumber: "" }} />,
    );
    expect(picker().getAttribute("aria-label")).toBe(
      "Phone country code: Nigeria +234",
    );
    expect(picker().textContent).toContain("+234");
    const flag = container.querySelector('[data-slot="country-flag"]')!;
    expect(flag.getAttribute("data-country")).toBe("NG");
    expect(flag.getAttribute("aria-hidden")).toBe("true");
    // The SVG flag loads as a separate chunk.
    await waitFor(() => expect(flag.querySelector("svg")).not.toBeNull());
  });

  it("searches countries by name, ISO code and calling code", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Phone />);

    const search = await openPicker(user);
    expect(visibleOptions().length).toBeGreaterThan(200);

    await user.type(search, "nigeria");
    expect(visibleOptions()).toEqual(["Nigeria+234"]);

    await user.clear(search);
    await user.type(search, "+44");
    expect(visibleOptions()).toEqual(
      expect.arrayContaining(["United Kingdom+44", "Guernsey+44", "Jersey+44"]),
    );

    await user.clear(search);
    await user.type(search, "AE");
    expect(visibleOptions()).toContain("United Arab Emirates+971");
  });

  it("selects a country with the keyboard and keeps the typed number", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Phone initial={{ countryCode: "US", nationalNumber: "416 555 0123" }} />,
    );

    await user.type(await openPicker(user), "canada");
    await user.keyboard("{Enter}");

    expect(value()).toBe("CA|416 555 0123");
    expect(picker().getAttribute("aria-label")).toBe(
      "Phone country code: Canada +1",
    );
  });

  it("revalidates the number when the country changes", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Phone initial={{ countryCode: "CA", nationalNumber: "" }} />);

    await user.type(numberInput(), "212 555 0123");
    await user.tab();
    expect(screen.getByText(/This is a United States number/)).toBeTruthy();
    expect(numberInput().getAttribute("aria-invalid")).toBe("true");
    expect(picker().getAttribute("aria-invalid")).toBe("true");

    await user.type(await openPicker(user), "united states");
    await user.click(
      screen
        .getAllByRole("option")
        .find((item) => item.textContent === "United States+1")!,
    );

    expect(value()).toBe("US|212 555 0123");
    expect(screen.queryByText(/This is a United States number/)).toBeNull();
  });

  it("asks for a country before the number can be checked", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Phone />);
    await user.type(numberInput(), "0803 123 4567");
    await user.tab();
    expect(
      screen.getByText("Select the country for this number."),
    ).toBeTruthy();
  });

  it("moves to the country of a pasted international number", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Phone initial={{ countryCode: "NG", nationalNumber: "" }} />);
    await user.click(numberInput());
    await user.paste("+44 20 7946 0958");
    await user.tab();
    expect(value()).toBe("GB|20 7946 0958");
  });

  it("reports a too-short number clearly", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Phone initial={{ countryCode: "NG", nationalNumber: "" }} required />,
    );
    await user.type(numberInput(), "0803");
    await user.tab();
    const error = screen.getByText("This number is too short for Nigeria.");
    expect(numberInput().getAttribute("aria-describedby")).toContain(error.id);
  });
});

describe("phone form helpers", () => {
  it("normalises a Nigerian number with its trunk prefix to E.164", () => {
    expect(
      phoneToE164({ countryCode: "NG", nationalNumber: "0803 123 4567" }),
    ).toBe("+2348031234567");
    expect(
      phoneToE164({ countryCode: "NG", nationalNumber: "803 123 4567" }),
    ).toBe("+2348031234567");
  });

  it("normalises international numbers", () => {
    expect(
      phoneToE164({ countryCode: "GB", nationalNumber: "020 7946 0958" }),
    ).toBe("+442079460958");
    expect(
      phoneToE164({ countryCode: "US", nationalNumber: "(212) 555-0123" }),
    ).toBe("+12125550123");
    expect(phoneToE164(EMPTY_PHONE)).toBe("");
  });

  it("treats an empty optional number as valid and a required one as missing", () => {
    const optional = phoneFieldSchema({ required: false });
    const required = phoneFieldSchema({ required: true });
    expect(
      optional.safeParse({ countryCode: "", nationalNumber: "" }).success,
    ).toBe(true);
    const missing = required.safeParse({
      countryCode: "NG",
      nationalNumber: "",
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]).toMatchObject({
      path: ["nationalNumber"],
      message: "Enter a phone number.",
    });
  });

  it.each([
    ["NG", "0803", "This number is too short for Nigeria."],
    ["NG", "0803 123 45678", "Enter a valid Nigeria number."],
    [
      "NG",
      "0803-CALL-ME",
      "Use digits only. Spaces, brackets and dashes are fine.",
    ],
  ])("rejects %s %j", (countryCode, nationalNumber, message) => {
    const result = phoneFieldSchema({ required: true }).safeParse({
      countryCode,
      nationalNumber,
    });
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("splits saved numbers and keeps unreadable ones for the user to fix", () => {
    expect(phoneFieldFromSaved("+2348031234567")).toEqual({
      countryCode: "NG",
      nationalNumber: "803 123 4567",
      savedText: undefined,
    });
    expect(phoneFieldFromSaved("08031234567", "NG").countryCode).toBe("NG");
    expect(phoneFieldFromSaved("ext. 12", "GB")).toEqual({
      countryCode: "GB",
      nationalNumber: "ext. 12",
      savedText: "ext. 12",
    });
  });
});
