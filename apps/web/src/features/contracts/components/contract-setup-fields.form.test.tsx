// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import {
  createContractDefaults,
  type CreateContractFormValues,
} from "../create-contract-schema";
import { ContractCommercialFields } from "./contract-setup-fields";

afterEach(cleanup);

function setup() {
  let form!: UseFormReturn<CreateContractFormValues>;
  function Harness() {
    form = useForm<CreateContractFormValues>({
      defaultValues: createContractDefaults("Africa/Lagos"),
    });
    return (
      <FormProvider {...form}>
        <form>
          <ContractCommercialFields />
        </form>
      </FormProvider>
    );
  }
  render(<Harness />);
  return { user: userEvent.setup({ delay: null }), form: () => form };
}

const field = (label: RegExp) =>
  screen.getByLabelText(label) as HTMLInputElement;

describe("contract amount fields", () => {
  it("adds grouping commas when the user leaves the field, not while typing", async () => {
    const { user, form } = setup();
    const value = field(/Original contract value/);

    await user.type(value, "1500000.5");
    expect(value.value).toBe("1500000.5");

    await user.tab();
    expect(value.value).toBe("1,500,000.5");
    expect(form().getValues("commercial.originalValue")).toBe("1,500,000.5");
    // The hint still shows the same amount.
    expect(
      screen.getByText(/1,500,000\.50\. Up to 2 decimal places\./),
    ).toBeTruthy();
  });

  it("regroups the amount after the user edits it", async () => {
    const { user, form } = setup();
    const value = field(/Original contract value/);
    await user.type(value, "1500000");
    await user.tab();
    expect(value.value).toBe("1,500,000");

    // Remove one zero: "1,500,000" becomes "1,50,000" while editing.
    await user.click(value);
    value.setSelectionRange(value.value.length, value.value.length);
    await user.keyboard(
      "{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{Backspace}",
    );
    expect(value.value).toBe("1,50,000");

    await user.tab();
    expect(value.value).toBe("150,000");
    expect(form().getValues("commercial.originalValue")).toBe("150,000");
    expect(
      screen.getByText(/150,000\.00\. Up to 2 decimal places\./),
    ).toBeTruthy();
  });

  it("groups liquidated damages the same way", async () => {
    const { user } = setup();
    const damages = field(/Liquidated damages per day/);

    await user.type(damages, "250000");
    await user.tab();

    expect(damages.value).toBe("250,000");
  });

  it("leaves an amount it can't read as typed, for validation to explain", async () => {
    const { user, form } = setup();
    const value = field(/Original contract value/);

    // Not regrouped into 1,500: the user may have meant 15.00.
    await user.type(value, "15,00");
    await user.tab();

    expect(value.value).toBe("15,00");
    expect(form().getValues("commercial.originalValue")).toBe("15,00");
  });

  it("leaves an empty optional amount empty", async () => {
    const { user } = setup();
    const damages = field(/Liquidated damages per day/);

    await user.click(damages);
    await user.tab();

    expect(damages.value).toBe("");
  });
});
