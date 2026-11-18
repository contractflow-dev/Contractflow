"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type {
  FieldErrors,
  FieldPath,
  FieldValues,
  UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

/** One step of a multi-step form. */
export interface FormStep<TValues extends FieldValues> {
  title: string;
  /**
   * The top-level fields (or field groups) shown on this step. Every field
   * belongs to exactly one step.
   */
  fields: ReadonlyArray<Extract<keyof TValues, string>>;
}

export type FormStepStatus = "completed" | "current" | "upcoming";

type FocusTarget = "heading" | "error";

/** The index of the step that owns the top-level `field`, or -1. */
function stepOwning<TValues extends FieldValues>(
  steps: ReadonlyArray<FormStep<TValues>>,
  field: string,
): number {
  return steps.findIndex((step) =>
    (step.fields as readonly string[]).includes(field),
  );
}

/**
 * Step navigation, validation, completion and focus for a multi-step
 * react-hook-form form whose `schema` is also its resolver.
 *
 * - Next (and Enter in a field: the form has one submit button on every step)
 *   validates only the current step's fields and moves on only when they are
 *   valid. The last step validates the whole form and, if any step has an
 *   error, returns to the earliest such step.
 * - A step is completed once the user has moved on from it with valid
 *   values, or, for the last step, once `onValid` succeeds. It stops being
 *   completed as soon as its values become invalid, and becomes completed
 *   again only when the user moves on from it again.
 * - Focus moves after the new step has rendered: to its heading when moving
 *   between steps, or to the first invalid field when validation fails.
 */
export function useFormSteps<
  TValues extends FieldValues,
  TStep extends FormStep<TValues>,
>({
  form,
  steps,
  schema,
  onValid,
}: {
  form: UseFormReturn<TValues>;
  steps: ReadonlyArray<TStep>;
  schema: z.ZodType;
  /** Saves the valid form; resolves to whether it was saved. */
  onValid: (values: TValues) => Promise<boolean>;
}) {
  const lastStep = steps.length - 1;
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Next and submit are async (validation); a second Enter or click while
  // one runs is ignored, so a step can't be skipped or a form sent twice.
  const busy = useRef(false);

  // Where focus goes once the step has rendered. The counter re-runs the
  // effect for each request, even when the step doesn't change.
  const focusTarget = useRef<FocusTarget | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const requestFocus = (target: FocusTarget) => {
    focusTarget.current = target;
    setFocusRequest((count) => count + 1);
  };

  /**
   * Focuses the first invalid control on screen, in reading order. Reads the
   * form's own field state, which is current as soon as validation returns,
   * rather than waiting for the error attributes to render.
   */
  const focusFirstInvalid = useCallback(() => {
    const controls =
      formRef.current?.querySelectorAll<HTMLElement>("[name]") ?? [];
    for (const control of controls) {
      const name = control.getAttribute("name") as FieldPath<TValues>;
      if (form.getFieldState(name).invalid) {
        control.focus();
        return;
      }
    }
  }, [form]);

  useEffect(() => {
    const target = focusTarget.current;
    focusTarget.current = null;
    if (target === "heading") headingRef.current?.focus();
    else if (target === "error") focusFirstInvalid();
  }, [focusRequest, focusFirstInvalid, stepIndex]);

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          // Once a field shows an error, re-check it as it changes, so the
          // error clears as soon as it is fixed.
          const field = name?.split(".")[0] as FieldPath<TValues> | undefined;
          if (field && form.getFieldState(field).invalid) {
            void form.trigger(field);
          }
          // A completed step whose values are no longer valid isn't
          // completed. The whole schema is checked, as the resolver does, so
          // checks that span fields count too.
          const result = schema.safeParse(form.getValues());
          if (result.success) return;
          const invalid = new Set(
            result.error.issues.map((issue) =>
              stepOwning(steps, String(issue.path[0])),
            ),
          );
          setCompleted((current) => {
            if (![...current].some((index) => invalid.has(index))) {
              return current;
            }
            return new Set([...current].filter((index) => !invalid.has(index)));
          });
        },
      }),
    [form, schema, steps],
  );

  const markCompleted = (index: number) =>
    setCompleted((current) =>
      current.has(index) ? current : new Set([...current, index]),
    );

  async function next() {
    if (busy.current) return;
    busy.current = true;
    const from = stepIndex;
    try {
      const valid = await form.trigger(
        steps[from].fields as unknown as Array<FieldPath<TValues>>,
      );
      if (!valid) {
        focusFirstInvalid();
        return;
      }
      markCompleted(from);
      setStepIndex(Math.min(from + 1, lastStep));
      requestFocus("heading");
    } finally {
      busy.current = false;
    }
  }

  function back() {
    if (busy.current) return;
    setStepIndex(Math.max(stepIndex - 1, 0));
    requestFocus("heading");
  }

  /**
   * The form's `onSubmit`. Before the last step it is Next; on the last step
   * it validates every step and calls `onValid`.
   */
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stepIndex < lastStep) {
      void next();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    void form
      .handleSubmit(
        async (values) => {
          if (await onValid(values)) markCompleted(lastStep);
        },
        (errors: FieldErrors<TValues>) => {
          const first = steps.findIndex((step) =>
            step.fields.some((field) => errors[field]),
          );
          setStepIndex(first === -1 ? lastStep : first);
          requestFocus("error");
        },
      )(event)
      .finally(() => {
        busy.current = false;
      });
  }

  /**
   * For the last step's submit button. A double-click on the previous
   * step's Next would otherwise land its second click here, on the button
   * that takes Next's place, and submit the form unseen.
   */
  function ignoreRepeatClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1) event.preventDefault();
  }

  const stepStatus = (index: number): FormStepStatus =>
    index === stepIndex
      ? "current"
      : completed.has(index)
        ? "completed"
        : "upcoming";

  return {
    stepIndex,
    step: steps[stepIndex],
    isLastStep: stepIndex === lastStep,
    stepStatus,
    isStepCompleted: (index: number) => completed.has(index),
    formRef,
    headingRef,
    back,
    onSubmit,
    ignoreRepeatClick,
  };
}
