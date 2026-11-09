import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormProvider, useForm, type FieldErrors } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { ECurrencyCode } from "@contractflow/contracts-schema";
import {
  createContractDefaults,
  type CreateContractFormValues,
} from "../create-contract-schema";
import {
  ContractBasicsFields,
  ContractCommercialFields,
  ContractDatesFields,
  ContractPartiesFields,
} from "./contract-setup-fields";

function Harness({
  values,
  errors,
  children,
}: {
  values?: CreateContractFormValues;
  errors?: FieldErrors<CreateContractFormValues>;
  children: ReactNode;
}) {
  const form = useForm<CreateContractFormValues>({
    defaultValues: values ?? createContractDefaults("Africa/Lagos"),
    errors,
  });
  return (
    <FormProvider {...form}>
      <form>{children}</form>
    </FormProvider>
  );
}

function renderAllSteps(
  props: {
    values?: CreateContractFormValues;
    errors?: FieldErrors<CreateContractFormValues>;
    parentContractsError?: unknown;
  } = {},
) {
  return renderToStaticMarkup(
    <Harness values={props.values} errors={props.errors}>
      <ContractBasicsFields />
      <ContractPartiesFields
        parentContracts={[
          { id: "parent-1", referenceNumber: "CTR-001", title: "Main works" },
        ]}
        parentContractsLoading={false}
        parentContractsError={props.parentContractsError}
      />
      <ContractCommercialFields />
      <ContractDatesFields />
    </Harness>,
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

describe("contract setup step fields", () => {
  it("groups each step's fields into labelled fieldsets", () => {
    const markup = renderAllSteps();
    const legends = [...markup.matchAll(/<legend[^>]*>([^<]+)<\/legend>/g)].map(
      (match) => match[1],
    );
    expect(legends).toEqual([
      "Contract basics",
      "Contract parties",
      "Workspaces",
      "Commercial terms",
      "Contract dates and duration",
    ]);
  });

  it("gives every control a label", () => {
    const markup = renderAllSteps();
    // Visible fields, not the hidden inputs behind the shared checkboxes.
    const ids = [
      ...markup.matchAll(
        /<(?:input|select|textarea)(?![^>]*aria-hidden)[^>]*id="([^"]+)"/g,
      ),
    ].map((match) => match[1]);
    expect(ids.length).toBe(19);
    for (const id of ids) expect(markup).toContain(`for="${id}"`);
    expect(markup.match(/role="checkbox"/g)).toHaveLength(3);
  });

  it("marks exactly the fields the API requires", () => {
    const markup = renderAllSteps();
    const required = [
      "referenceNumber",
      "title",
      "contractType",
      "partyType",
      "originalValue",
      "currencyCode",
      "paymentTermsDays",
      "retentionRate",
      "awardDate",
      "startDate",
      "endDate",
      "defectsLiabilityDays",
      "timezone",
    ];
    const optional = [
      "description",
      "parentContractId",
      "advancePaymentRate",
      "liquidatedDamagesPerDay",
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
  });

  it("asks for amounts and percentages, not minor units or basis points", () => {
    const markup = renderAllSteps();

    expect(markup).not.toMatch(/minor units|smallest unit/i);
    expect(markup).not.toMatch(/\(basis points\)/);
    expect(markup).toContain(">Retention rate (%)");
    expect(markup).toContain(">Advance payment rate (%)");
    expect(controlTag(markup, "new-contract-originalValue")).toContain(
      'inputMode="decimal"',
    );
    expect(controlTag(markup, "new-contract-originalValue")).not.toContain(
      'type="number"',
    );
  });

  it("echoes typed amounts and rates in their own format", () => {
    const values = createContractDefaults("UTC");
    values.commercial.currencyCode = ECurrencyCode.USD;
    values.commercial.originalValue = "1500.5";
    values.commercial.retentionRate = "5";
    const markup = renderAllSteps({ values });

    // Formatted in the runtime's locale: "$1,500.50" or "US$1,500.50".
    expect(markup).toMatch(/(US)?\$1,500\.50\. Up to 2 decimal places\./);
    expect(markup).toContain("5% (500 basis points).");
    expect(controlTag(markup, "new-contract-originalValue")).toContain(
      'aria-describedby="new-contract-originalValue-description"',
    );
  });

  it("offers time zones from a list", () => {
    const markup = renderAllSteps();
    const select = markup.match(
      /<select[^>]*id="new-contract-timezone"[\s\S]*?<\/select>/,
    )?.[0];
    expect(select).toBeDefined();
    // React Hook Form selects the default through a ref in the browser.
    expect(select).toMatch(/<option[^>]*value="UTC"[^>]*>UTC<\/option>/);
    expect(select).toMatch(
      /<option[^>]*value="Africa\/Lagos"[^>]*>Africa\/Lagos<\/option>/,
    );
    expect(select).toMatch(
      /<option[^>]*value="America\/New_York"[^>]*>America\/New York<\/option>/,
    );
  });

  it("shows an error beside the field it concerns", () => {
    const markup = renderAllSteps({
      errors: {
        dates: {
          startDate: {
            type: "custom",
            message: "The start date must not be after the end date.",
          },
        },
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
    const markup = renderAllSteps({
      parentContractsError: { status: 500, data: {} },
    });
    expect(controlTag(markup, "new-contract-parentContractId")).toContain(
      "new-contract-parentContractId-error",
    );
  });

  it("lists parent contracts by reference and title", () => {
    expect(renderAllSteps()).toContain("CTR-001 · Main works");
  });

  it("checks every workspace by default", () => {
    expect(
      renderAllSteps().match(/role="checkbox"[^>]*aria-checked="true"/g),
    ).toHaveLength(3);
  });
});
