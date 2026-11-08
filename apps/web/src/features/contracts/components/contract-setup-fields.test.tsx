import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ContractSetupFields,
  validateContractDates,
  type ContractDateValues,
} from "./contract-setup-fields";

const validDates: ContractDateValues = {
  awardDate: "2026-01-01",
  startDate: "2026-02-01",
  endDate: "2026-12-31",
  revisedEndDate: "",
  actualCompletionDate: "",
};

describe("validateContractDates", () => {
  it("accepts dates in order and leaves optional dates empty", () => {
    expect(validateContractDates(validDates)).toEqual({});
  });

  it("accepts a start date equal to the end date", () => {
    expect(
      validateContractDates({ ...validDates, startDate: "2026-12-31" }),
    ).toEqual({});
  });

  it("flags a start date after the end date on the start date", () => {
    expect(
      validateContractDates({ ...validDates, startDate: "2027-01-01" }),
    ).toEqual({
      startDate: "The start date must not be after the end date.",
    });
  });

  it("flags a revised end date before the end date", () => {
    expect(
      validateContractDates({ ...validDates, revisedEndDate: "2026-12-30" }),
    ).toEqual({
      revisedEndDate: "The revised end date must not be before the end date.",
    });
  });

  it("flags an actual completion date before the start date", () => {
    expect(
      validateContractDates({
        ...validDates,
        actualCompletionDate: "2026-01-31",
      }),
    ).toEqual({
      actualCompletionDate:
        "The actual completion date must not be before the start date.",
    });
  });

  it("leaves missing required dates to the browser's required check", () => {
    expect(
      validateContractDates({ ...validDates, startDate: "", endDate: "" }),
    ).toEqual({});
  });
});

function renderFields(
  props: Partial<Parameters<typeof ContractSetupFields>[0]> = {},
) {
  return renderToStaticMarkup(
    <ContractSetupFields
      parentContracts={[
        { id: "parent-1", referenceNumber: "CTR-001", title: "Main works" },
      ]}
      parentContractsLoading={false}
      {...props}
    />,
  );
}

/** The opening tag of the control with this id. */
function controlTag(markup: string, id: string): string {
  const tag = markup.match(
    new RegExp(`<(?:input|select|textarea)[^>]*id="${id}"[^>]*>`),
  )?.[0];
  if (!tag) throw new Error(`No control with id ${id}`);
  return tag;
}

describe("ContractSetupFields", () => {
  it("groups the fields into labelled fieldsets", () => {
    const markup = renderFields();
    const legends = [...markup.matchAll(/<legend[^>]*>([^<]+)<\/legend>/g)].map(
      (match) => match[1],
    );
    expect(legends).toEqual([
      "Contract overview",
      "Contract parties",
      "Commercial terms",
      "Contract dates and duration",
      "Workspaces",
    ]);
    expect(markup.match(/<fieldset/g)).toHaveLength(5);
  });

  it("gives every control a label", () => {
    const markup = renderFields();
    const ids = [
      ...markup.matchAll(/<(?:input|select|textarea)[^>]*id="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(ids.length).toBe(19);
    for (const id of ids) expect(markup).toContain(`for="${id}"`);
    // Workspace checkboxes are labelled by their wrapping <label>.
    expect(markup.match(/<label[^>]*><input type="checkbox"/g)).toHaveLength(
      3,
    );
  });

  it("marks exactly the fields the API requires", () => {
    const markup = renderFields();
    const required = [
      "referenceNumber",
      "title",
      "contractType",
      "partyType",
      "originalValueMinor",
      "currencyCode",
      "paymentTermsDays",
      "retentionRateBps",
      "awardDate",
      "startDate",
      "endDate",
      "defectsLiabilityDays",
      "timezone",
    ];
    const optional = [
      "description",
      "parentContractId",
      "advancePaymentRateBps",
      "liquidatedDamagesPerDayMinor",
      "revisedEndDate",
      "actualCompletionDate",
    ];
    for (const name of required) {
      expect(controlTag(markup, `new-contract-${name}`)).toContain(
        'aria-required="true"',
      );
    }
    for (const name of optional) {
      expect(controlTag(markup, `new-contract-${name}`)).not.toContain(
        "aria-required",
      );
    }
    expect(markup.match(/data-slot="required-indicator"/g)).toHaveLength(
      required.length,
    );
    expect(markup.match(/data-slot="optional-indicator"/g)).toHaveLength(
      optional.length,
    );
  });

  it("keeps the names the form reads with FormData", () => {
    const markup = renderFields();
    expect(controlTag(markup, "new-contract-originalValueMinor")).toContain(
      'name="originalValueMinor"',
    );
    expect(controlTag(markup, "new-contract-timezone")).toContain(
      'name="timezone"',
    );
  });

  it("explains minor units and basis points with worked examples", () => {
    const markup = renderFields();
    expect(markup).toContain("the currency&#x27;s smallest unit");
    // Formatted in the runtime's locale: "$1,500.00" or "US$1,500.00".
    expect(markup).toMatch(/150000 is (US)?\$1,500\.00/);
    expect(markup).toContain("100 basis points equal 1%. 0 is 0%.");
    expect(controlTag(markup, "new-contract-originalValueMinor")).toContain(
      'aria-describedby="new-contract-originalValueMinor-description"',
    );
  });

  it("shows date errors beside the date they concern", () => {
    const markup = renderFields({
      dateErrors: {
        startDate: "The start date must not be after the end date.",
      },
    });
    expect(controlTag(markup, "new-contract-startDate")).toContain(
      'aria-describedby="new-contract-startDate-description new-contract-startDate-error"',
    );
    expect(controlTag(markup, "new-contract-startDate")).toContain(
      'aria-invalid="true"',
    );
    // The Input class list mentions "aria-invalid:", so match the attribute.
    expect(controlTag(markup, "new-contract-endDate")).not.toContain(
      'aria-invalid="true"',
    );
    expect(markup).toContain("The start date must not be after the end date.");
  });

  it("shows a parent contract load failure on that field", () => {
    const markup = renderFields({
      parentContracts: [],
      parentContractsError: { status: 500, data: {} },
    });
    expect(controlTag(markup, "new-contract-parentContractId")).toContain(
      "new-contract-parentContractId-error",
    );
  });

  it("lists parent contracts by reference and title", () => {
    expect(renderFields()).toContain("CTR-001 · Main works");
  });
});
