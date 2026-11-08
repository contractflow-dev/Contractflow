import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field";

/**
 * Form composition used across ContractFlow.
 *
 * Conventions:
 * - Every control has a visible label tied to it with `htmlFor`/`id`.
 * - Required fields show an asterisk (hidden from screen readers, which hear
 *   "required" instead). Pass `required` only when validation actually
 *   requires the field. Forms that use the asterisk show
 *   `<RequiredFieldsNote />` once, above the fields.
 * - In forms that mix required and optional fields, optional ones may say
 *   "Optional" instead. Short inline forms (a search box, a single invite
 *   email) need neither marker.
 * - Helper text and field errors are linked to the control with
 *   `aria-describedby`, so screen readers read them with the label.
 */

/** The accessibility props a `FormField` hands to its control. */
export interface FormControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

export function FormField({
  id,
  label,
  required = false,
  optional = false,
  description,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  /** Shows the required indicator and sets `aria-required` on the control. */
  required?: boolean;
  /** Shows "Optional" after the label. Ignored when `required` is set. */
  optional?: boolean;
  description?: ReactNode;
  /** A field-level error message; the field is marked invalid while set. */
  error?: string;
  className?: string;
  /** Renders the control, spreading the given props onto it. */
  children: (control: FormControlProps) => ReactNode;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <Field
      data-invalid={error ? true : undefined}
      // The primitive turns the whole invalid field red, which the control
      // inherits: red typed text on the input fill fails 4.5:1 contrast.
      // Keep typed text in the foreground colour and colour only the label;
      // the control's red border and the error message mark the error too.
      className={cn("gap-2 data-[invalid=true]:text-foreground", className)}
    >
      <FieldLabel
        htmlFor={id}
        className="flex-wrap gap-x-1.5 gap-y-0.5 group-data-[invalid=true]/field:text-destructive"
      >
        {label}
        {required ? <RequiredIndicator /> : optional ? <OptionalIndicator /> : null}
      </FieldLabel>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {description ? (
        <FieldDescription id={descriptionId} className="text-xs">
          {description}
        </FieldDescription>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

/** The asterisk after a required field's label. */
export function RequiredIndicator() {
  return (
    <span data-slot="required-indicator" className="text-destructive">
      <span aria-hidden="true">*</span>
      <span className="sr-only">(required)</span>
    </span>
  );
}

function OptionalIndicator() {
  return (
    <span
      data-slot="optional-indicator"
      className="text-xs font-normal text-muted-foreground"
    >
      Optional
    </span>
  );
}

/** Explains the asterisk; shown once in each form that uses it. */
export function RequiredFieldsNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Fields marked with an asterisk (
      <span className="text-destructive">*</span>) are required.
    </p>
  );
}

/**
 * A titled group of related fields: a semantic `fieldset` named by its
 * `legend`, with an optional description read when the group is entered.
 * Consecutive sections are separated by a rule.
 */
export function FormSection({
  legend,
  description,
  className,
  children,
}: {
  legend: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const descriptionId = useId();
  return (
    <FieldSet
      data-slot="form-section"
      aria-describedby={description ? descriptionId : undefined}
      // Fieldsets default to min-width: min-content, which lets wide
      // content push the page sideways on small screens.
      className={cn(
        "min-w-0 gap-4",
        "[[data-slot=form-section]+&]:border-t [[data-slot=form-section]+&]:pt-6",
        className,
      )}
    >
      {/* The "label" variant sizes the legend as text-sm; without it the
          primitive's higher-specificity text-base would override the
          subsection title. font-semibold replaces its font-medium. */}
      <FieldLegend
        variant="label"
        className="mb-1 type-subsection-title font-semibold"
      >
        {legend}
      </FieldLegend>
      {description ? (
        <FieldDescription id={descriptionId} className="-mt-1 text-xs">
          {description}
        </FieldDescription>
      ) : null}
      {children}
    </FieldSet>
  );
}

const GRID_COLUMNS = {
  1: "grid gap-4",
  2: "grid gap-4 sm:grid-cols-2",
  3: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
} as const;

/** A responsive grid of fields that collapses to one column on phones. */
export function FormGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: keyof typeof GRID_COLUMNS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(GRID_COLUMNS[columns], "items-start", className)}>
      {children}
    </div>
  );
}
