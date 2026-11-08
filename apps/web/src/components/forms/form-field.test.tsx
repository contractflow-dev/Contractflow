import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FormField,
  FormGrid,
  FormSection,
  RequiredFieldsNote,
} from "./form-field";

function renderField(props: Partial<Parameters<typeof FormField>[0]> = {}) {
  return renderToStaticMarkup(
    <FormField id="contract-title" label="Contract title" {...props}>
      {(control) => <input {...control} name="title" />}
    </FormField>,
  );
}

describe("FormField", () => {
  it("ties a visible label to its control", () => {
    const markup = renderField();
    expect(markup).toContain('for="contract-title"');
    expect(markup).toContain('id="contract-title"');
    expect(markup).toContain("Contract title");
  });

  it("marks a required field visibly and for screen readers", () => {
    const markup = renderField({ required: true });
    expect(markup).toContain('aria-required="true"');
    // The asterisk is decorative; screen readers hear "(required)".
    expect(markup).toContain('<span aria-hidden="true">*</span>');
    expect(markup).toContain('<span class="sr-only">(required)</span>');
    expect(markup).not.toContain("Optional");
  });

  it("labels an optional field without marking it required", () => {
    const markup = renderField({ optional: true });
    expect(markup).toContain('data-slot="optional-indicator"');
    expect(markup).toContain("Optional");
    expect(markup).not.toContain("aria-required");
    expect(markup).not.toContain("(required)");
  });

  it("shows no indicator when neither is set", () => {
    const markup = renderField();
    expect(markup).not.toContain("required-indicator");
    expect(markup).not.toContain("optional-indicator");
    expect(markup).not.toContain("aria-describedby");
  });

  it("prefers the required indicator when both are set", () => {
    const markup = renderField({ required: true, optional: true });
    expect(markup).toContain("required-indicator");
    expect(markup).not.toContain("optional-indicator");
  });

  it("links helper text to the control", () => {
    const markup = renderField({ description: "Up to 255 characters." });
    expect(markup).toContain('aria-describedby="contract-title-description"');
    expect(markup).toContain('id="contract-title-description"');
    expect(markup).toContain("Up to 255 characters.");
  });

  it("links a field error to the control and marks it invalid", () => {
    const markup = renderField({
      description: "Up to 255 characters.",
      error: "Enter a contract title.",
    });
    expect(markup).toContain(
      'aria-describedby="contract-title-description contract-title-error"',
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('data-invalid="true"');
    expect(markup).toMatch(
      /<div role="alert"[^>]*id="contract-title-error"[^>]*>Enter a contract title\.<\/div>/,
    );
  });

  it("keeps typed text readable when invalid, colouring only the label", () => {
    // Regression: the Field primitive turns an invalid field red and the
    // control inherited it (3.86:1 on the input fill in a browser audit).
    const markup = renderField({ error: "Enter a contract title." });
    expect(markup).toMatch(
      /data-slot="field"[^>]*class="[^"]*data-\[invalid=true\]:text-foreground/,
    );
    expect(markup).not.toMatch(
      /data-slot="field"[^>]*class="[^"]*data-\[invalid=true\]:text-destructive/,
    );
    expect(markup).toContain("group-data-[invalid=true]/field:text-destructive");
  });

  it("does not mark a field invalid without an error", () => {
    const markup = renderField({ description: "Help" });
    expect(markup).not.toContain("aria-invalid");
    expect(markup).not.toContain('role="alert"');
  });
});

describe("FormSection", () => {
  it("groups fields in a fieldset named by its legend", () => {
    const markup = renderToStaticMarkup(
      <FormSection legend="Commercial terms">
        <span>fields</span>
      </FormSection>,
    );
    expect(markup).toMatch(/^<fieldset[^>]*data-slot="form-section"/);
    expect(markup).toMatch(/<legend[^>]*>Commercial terms<\/legend>/);
    // Prevents fieldset min-content width from causing horizontal scroll.
    expect(markup).toContain("min-w-0");
    expect(markup).not.toContain("aria-describedby");
  });

  it("describes the group with its description", () => {
    const markup = renderToStaticMarkup(
      <FormSection legend="Workspaces" description="Choose the workspaces.">
        <span>fields</span>
      </FormSection>,
    );
    const describedBy = markup.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(markup).toContain(`id="${describedBy}"`);
    expect(markup).toContain("Choose the workspaces.");
  });
});

describe("FormGrid", () => {
  it.each([
    [1, "grid gap-4"],
    [2, "sm:grid-cols-2"],
    [3, "lg:grid-cols-3"],
  ] as const)("lays out %i column(s), one on phones", (columns, expected) => {
    const markup = renderToStaticMarkup(
      <FormGrid columns={columns}>
        <span />
      </FormGrid>,
    );
    expect(markup).toContain(expected);
    expect(markup).not.toMatch(/class="[^"]*(?<!:)grid-cols-[23]/);
  });
});

describe("RequiredFieldsNote", () => {
  it("explains the asterisk", () => {
    expect(renderToStaticMarkup(<RequiredFieldsNote />)).toContain(
      "are required.",
    );
  });
});
