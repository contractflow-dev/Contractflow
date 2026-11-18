import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The title block at the top of a screen11. It renders the page's only <h1>, so
 * sections below it start at <h2>.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  /** A short label above the title, such as "Company administration". */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /**
   * The page's primary action, such as "New contract", at the top right.
   * Pass it only to users allowed to use it. It follows the heading in the
   * reading order and wraps below it on phones.
   */
  actions?: ReactNode;
  className?: string;
}) {
  const heading = (
    <>
      {eyebrow ? <p className="type-eyebrow">{eyebrow}</p> : null}
      <h1 className={cn("type-page-title break-words", eyebrow && "mt-1")}>
        {title}
      </h1>
      {description ? <p className="mt-1 type-lead">{description}</p> : null}
    </>
  );
  if (!actions) return <header className={className}>{heading}</header>;
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">{heading}</div>
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    </header>
  );
}
