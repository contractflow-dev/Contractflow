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
  className,
}: {
  /** A short label above the title, such as "Company administration". */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className}>
      {eyebrow ? <p className="type-eyebrow">{eyebrow}</p> : null}
      <h1 className={cn("type-page-title break-words", eyebrow && "mt-1")}>
        {title}
      </h1>
      {description ? <p className="mt-1 type-lead">{description}</p> : null}
    </header>
  );
}
