import { cn } from "@/lib/utils";

/**
 * Sidebar "icons" for the department workspaces: a dot in each department's
 * colour token, sized like the other navigation icons.
 */
function departmentDot(colour: string) {
  function DepartmentDot({ className }: { className?: string }) {
    return (
      <span
        aria-hidden="true"
        className={cn("grid shrink-0 place-items-center", className)}
      >
        <span className={cn("size-2 rounded-full", colour)} />
      </span>
    );
  }
  return DepartmentDot;
}

export const ContractorDot = departmentDot("bg-dept-contractor");
export const ClientPmDot = departmentDot("bg-dept-client-pm");
export const HseDot = departmentDot("bg-dept-hse");
export const FinanceDot = departmentDot("bg-dept-finance");
