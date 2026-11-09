import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";

// The shared controls own their height, radius and resting border, so pages
// can use them without per-screen overrides (DS-07).
const classes = (markup: string, slot: string) =>
  new RegExp(
    `data-slot="${slot}"[^>]*class="([^"]*)"|class="([^"]*)"[^>]*data-slot="${slot}"`,
  )
    .exec(markup)
    ?.slice(1)
    .find(Boolean)
    ?.split(/\s+/) ?? [];

describe("shared control sizing", () => {
  it("gives buttons a 40px default with compact and large variants", () => {
    const size = (s?: "xs" | "sm" | "lg" | "xl" | "icon") =>
      buttonVariants({ size: s }).split(/\s+/);

    expect(size()).toContain("h-10");
    expect(size("sm")).toContain("h-8");
    expect(size("xs")).toContain("h-7");
    expect(size("lg")).toContain("h-11");
    expect(size("icon")).toContain("size-10");
    // Full-width calls to action wrap long labels but never drop below 44px.
    expect(size("xl")).toEqual(
      expect.arrayContaining(["min-h-11", "h-auto", "whitespace-normal"]),
    );
    expect(buttonVariants().split(/\s+/)).toContain("rounded-2xl");
  });

  it("matches inputs, selects and input groups to the button height", () => {
    const markup = renderToStaticMarkup(
      <>
        <Input aria-label="Name" />
        <NativeSelect aria-label="Status">
          <NativeSelectOption value="a">A</NativeSelectOption>
        </NativeSelect>
        <InputGroup>
          <InputGroupInput aria-label="Search" />
        </InputGroup>
      </>,
    );

    for (const slot of ["input", "native-select", "input-group"]) {
      expect(classes(markup, slot)).toEqual(
        expect.arrayContaining(["h-10", "rounded-2xl"]),
      );
    }
  });

  it("gives every text-like control a visible resting border and a focus ring", () => {
    const markup = renderToStaticMarkup(
      <>
        <Input aria-label="Name" />
        <Textarea aria-label="Notes" />
        <NativeSelect aria-label="Status">
          <NativeSelectOption value="a">A</NativeSelectOption>
        </NativeSelect>
        <InputGroup>
          <InputGroupInput aria-label="Search" />
        </InputGroup>
        <Checkbox aria-label="Agree" />
      </>,
    );

    for (const slot of [
      "input",
      "textarea",
      "native-select",
      "input-group",
      "checkbox",
    ]) {
      const list = classes(markup, slot);
      expect(list, slot).toContain("border-field-border");
      expect(list, slot).not.toContain("border-transparent");
    }
    for (const slot of ["input", "textarea", "native-select", "checkbox"]) {
      expect(classes(markup, slot), slot).toEqual(
        expect.arrayContaining([
          "focus-visible:border-ring",
          "focus-visible:ring-3",
        ]),
      );
    }
  });
});
