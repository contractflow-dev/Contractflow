"use client";

import { useId, type ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@/lib/utils";

/**
 * The card every list sits in (UI guide §7.3): its heading, description and
 * primary action in the card header, then its filters, toolbar, table or
 * cards, and pagination in the content, all at the card's own padding.
 * Only the page title sits above it.
 *
 * Use it for every list, so lists share their spacing and alignment; don't
 * strip the card's padding or draw a header strip of your own.
 */
export function ListCard({
  title,
  headingId,
  description,
  action,
  id,
  className,
  contentClassName,
  children,
}: {
  /** The list's heading, an <h2>. It names the section. */
  title: ReactNode;
  /** The heading's id, when something else refers to it. */
  headingId?: string;
  description?: ReactNode;
  /** The list's primary action, top right: a button or link. */
  action?: ReactNode;
  /** The section's id, for links into the page. */
  id?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const labelId = headingId ?? `${generatedId}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={labelId}
      className={cn(id && "scroll-mt-24", className)}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id={labelId}>{title}</h2>
          </CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
        <CardContent className={cn("space-y-5", contentClassName)}>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
