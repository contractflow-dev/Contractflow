import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormStepStatus } from "@/hooks/use-form-steps";

/**
 * The steps of a multi-step form, in order: completed steps show a green
 * check, the current step is highlighted, upcoming steps are muted. On
 * phones only the numbers and checks show; the step heading names the step.
 */
export function FormStepList({
  steps,
  stepStatus,
  isStepCompleted,
}: {
  steps: ReadonlyArray<{ title: string }>;
  stepStatus: (index: number) => FormStepStatus;
  isStepCompleted: (index: number) => boolean;
}) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap gap-2 text-sm">
      {steps.map((step, index) => {
        const status = stepStatus(index);
        return (
          <li
            key={step.title}
            data-status={status}
            aria-current={status === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1",
              status === "current" &&
                "border-primary bg-primary/10 font-medium text-foreground",
              status === "completed" &&
                "border-success/40 bg-success-soft text-success-soft-foreground",
              status === "upcoming" && "text-muted-foreground",
            )}
          >
            {status === "completed" ? (
              <Check
                data-slot="step-completed-icon"
                className="size-4 text-success"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            ) : (
              <span className="tabular-nums" aria-hidden="true">
                {index + 1}
              </span>
            )}
            <span className="max-sm:sr-only">
              {step.title}
              {/* Not by colour alone: the state is also said in words. */}
              {isStepCompleted(index) ? (
                <span className="sr-only"> (completed)</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
