// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormStepList } from "@/components/forms/form-step-list";
import { useFormSteps, type FormStep } from "./use-form-steps";

// jsdom typing is slow under a busy parallel run.
vi.setConfig({ testTimeout: 20_000 });

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  notes: z.string(),
  email: z.email("Enter an email."),
  city: z.string().trim().min(1, "Enter a city."),
});
type Values = z.infer<typeof schema>;

const steps: ReadonlyArray<FormStep<Values>> = [
  { title: "Name", fields: ["name", "notes"] },
  { title: "Email", fields: ["email"] },
  { title: "City", fields: ["city"] },
];

/** A three-step form built the way the onboarding and contract forms are. */
function Harness({
  onValid,
}: {
  onValid: (values: Values) => Promise<boolean>;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", notes: "", email: "", city: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const {
    stepIndex,
    step,
    isLastStep,
    stepStatus,
    isStepCompleted,
    formRef,
    headingRef,
    back,
    onSubmit,
    ignoreRepeatClick,
  } = useFormSteps({ form, steps, schema, onValid });
  const errors = form.formState.errors;
  const field = (name: keyof Values, label: string) => (
    <div>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...form.register(name)}
      />
      {errors[name] ? (
        <p id={`${name}-error`}>{errors[name]?.message}</p>
      ) : null}
    </div>
  );

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-label="Harness">
      <FormStepList
        steps={steps}
        stepStatus={stepStatus}
        isStepCompleted={isStepCompleted}
      />
      <h2 ref={headingRef} tabIndex={-1}>
        Step {stepIndex + 1}: {step.title}
      </h2>
      {stepIndex === 0 ? (
        <>
          {field("name", "Name")}
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" {...form.register("notes")} />
        </>
      ) : null}
      {stepIndex === 1 ? field("email", "Email") : null}
      {stepIndex === 2 ? field("city", "City") : null}
      {/* Changes a value on another step, as a cross-step rule could. */}
      <button type="button" onClick={() => form.setValue("name", "")}>
        Clear name elsewhere
      </button>
      {stepIndex > 0 ? (
        <button type="button" onClick={back}>
          Back
        </button>
      ) : null}
      {!isLastStep ? (
        <button key="next" type="submit">
          Next
        </button>
      ) : (
        <button key="save" type="submit" onClick={ignoreRepeatClick}>
          Save
        </button>
      )}
    </form>
  );
}

function setup(
  onValid: (values: Values) => Promise<boolean> = vi.fn(async () => true),
) {
  const user = userEvent.setup({ delay: null });
  render(<Harness onValid={onValid} />);
  return { user, onValid };
}

const stepItem = (title: string) =>
  screen.getByText(title, { selector: "li span" }).closest("li")!;
const heading = () => screen.getByRole("heading", { level: 2 });

async function completeFirstTwo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Ada");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Step 2: Email");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Step 3: City");
}

afterEach(cleanup);

describe("useFormSteps", () => {
  it("starts with no step completed and the first one current", () => {
    setup();
    expect(stepItem("Name").getAttribute("aria-current")).toBe("step");
    for (const title of ["Name", "Email", "City"]) {
      expect(stepItem(title).dataset.status).not.toBe("completed");
      expect(stepItem(title).textContent).not.toContain("(completed)");
    }
    expect(
      document.querySelector("[data-slot=step-completed-icon]"),
    ).toBeNull();
  });

  it("stays on an invalid step, shows its error and focuses the field", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Enter a name.")).toBeTruthy();
    expect(heading().textContent).toBe("Step 1: Name");
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toBe(
      "name-error",
    );
    expect(stepItem("Name").dataset.status).toBe("current");
  });

  it("marks a valid step completed with a green check and moves focus to the next step", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(document.activeElement).toBe(heading()));
    expect(heading().textContent).toBe("Step 2: Email");
    const done = stepItem("Name");
    expect(done.dataset.status).toBe("completed");
    expect(done.querySelector("[data-slot=step-completed-icon]")).toBeTruthy();
    expect(done.className).toContain("bg-success-soft");
    expect(done.textContent).toContain("(completed)");
    // The current and upcoming steps are not completed, and have no check.
    expect(stepItem("Email").dataset.status).toBe("current");
    expect(stepItem("City").dataset.status).toBe("upcoming");
    expect(
      document.querySelectorAll("[data-slot=step-completed-icon]"),
    ).toHaveLength(1);
    // Only the step being left was validated.
    expect(screen.queryByText("Enter an email.")).toBeNull();
  });

  it("goes back with values kept, and keeps a still-valid step completed", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 2: Email");
    await user.type(screen.getByLabelText("Email"), "ada@");
    await user.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => expect(document.activeElement).toBe(heading()));
    expect(heading().textContent).toBe("Step 1: Name");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Ada");
    // Current, so not shown with a check, but still completed.
    expect(stepItem("Name").dataset.status).toBe("current");
    expect(stepItem("Name").textContent).toContain("(completed)");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 2: Email");
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "ada@");
    expect(stepItem("Name").dataset.status).toBe("completed");
  });

  it("drops a step's completion when an edit makes it invalid, until it is passed again", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 2: Email");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByText("Step 1: Name");

    await user.clear(screen.getByLabelText("Name"));
    expect(stepItem("Name").textContent).not.toContain("(completed)");

    // Fixing it isn't enough: the step is completed again on Next.
    await user.type(screen.getByLabelText("Name"), "Ada L");
    expect(stepItem("Name").textContent).not.toContain("(completed)");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 2: Email");
    expect(stepItem("Name").dataset.status).toBe("completed");
  });

  it("advances on Enter in an input, but not in a textarea", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.type(screen.getByLabelText("Notes"), "line one{Enter}line two");

    expect(screen.getByLabelText("Notes")).toHaveProperty(
      "value",
      "line one\nline two",
    );
    expect(heading().textContent).toBe("Step 1: Name");

    await user.type(screen.getByLabelText("Name"), "{Enter}");
    await screen.findByText("Step 2: Email");
  });

  it("can't be pushed past an unchecked step by Enter pressed again while checking", async () => {
    const { user, onValid } = setup();
    await user.type(screen.getByLabelText("Name"), "Ada");
    // Both arrive before the first step's validation has finished.
    const form = screen.getByRole("form", { name: "Harness" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);

    await screen.findByText("Step 2: Email");
    await waitFor(() => expect(document.activeElement).toBe(heading()));
    expect(stepItem("Email").dataset.status).toBe("current");
    expect(stepItem("Email").textContent).not.toContain("(completed)");
    expect(screen.queryByText("Step 3: City")).toBeNull();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("ignores the second click of a double-click on Next that lands on Save", async () => {
    const { user, onValid } = setup();
    await completeFirstTwo(user);
    await user.type(screen.getByLabelText("City"), "Lagos");
    // Save takes Next's place, so a double-click's second click (detail 2)
    // lands on it.
    fireEvent.click(screen.getByRole("button", { name: "Save" }), {
      detail: 2,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onValid).not.toHaveBeenCalled();

    // A single click still saves.
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
  });

  it("keeps an invalid last step open with its field focused", async () => {
    const { user, onValid } = setup();
    await completeFirstTwo(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter a city.")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("City")),
    );
    expect(onValid).not.toHaveBeenCalled();
  });

  it("validates the whole form on submit and returns to the earliest step with an error", async () => {
    const { user, onValid } = setup();
    await completeFirstTwo(user);
    await user.type(screen.getByLabelText("City"), "Lagos");
    await user.click(
      screen.getByRole("button", { name: "Clear name elsewhere" }),
    );
    // The first step lost its completion when its value became invalid.
    expect(stepItem("Name").textContent).not.toContain("(completed)");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Step 1: Name")).toBeTruthy();
    expect(screen.getByText("Enter a name.")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Name")),
    );
    expect(onValid).not.toHaveBeenCalled();
    // Values on the other steps are kept.
    await user.type(screen.getByLabelText("Name"), "Ada{Enter}");
    await screen.findByText("Step 2: Email");
    expect(screen.getByLabelText("Email")).toHaveProperty(
      "value",
      "ada@example.com",
    );
  });

  it("completes the last step only when saving succeeds", async () => {
    const onValid = vi.fn<(values: Values) => Promise<boolean>>();
    onValid.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { user } = setup(onValid);
    await completeFirstTwo(user);
    await user.type(screen.getByLabelText("City"), "Lagos");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(stepItem("City").textContent).not.toContain("(completed)");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(stepItem("City").textContent).toContain("(completed)"),
    );
    expect(onValid).toHaveBeenLastCalledWith({
      name: "Ada",
      notes: "",
      email: "ada@example.com",
      city: "Lagos",
    });
  });

  it("sends the form once while a save is in progress", async () => {
    let finish: (saved: boolean) => void = () => undefined;
    const onValid = vi.fn(
      () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    const { user } = setup(onValid);
    await completeFirstTwo(user);
    await user.type(screen.getByLabelText("City"), "Lagos");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.type(screen.getByLabelText("City"), "{Enter}");
    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));

    finish(true);
    await waitFor(() =>
      expect(stepItem("City").textContent).toContain("(completed)"),
    );
    expect(onValid).toHaveBeenCalledTimes(1);
  });
});
