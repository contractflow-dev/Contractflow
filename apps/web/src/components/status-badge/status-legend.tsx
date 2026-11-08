"use client";

import { useId, useState } from "react";
import { RiArrowDownSLine } from "@remixicon/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@/lib/utils";
import { TONE_VARIANT, getStatusPresentation } from "./status-badge";

/** One status and what it means in the screen that shows the legend. */
export interface StatusLegendItem {
  status: string;
  description: string;
}

/**
 * Explains the statuses a screen displays. Each entry shows the same badge
 * the screen uses next to a plain-language meaning, so the legend never
 * relies on colour. Legend badges carry `data-legend-status`, not
 * `data-status`, so they are never mistaken for a record's status.
 */
export function StatusLegend({
  items,
  className,
}: {
  items: StatusLegendItem[];
  className?: string;
}) {
  return (
    <dl
      data-slot="status-legend"
      className={cn("grid gap-x-4 gap-y-2.5 sm:grid-cols-2", className)}
    >
      {items.map(({ status, description }) => {
        const { label, tone } = getStatusPresentation(status);
        return (
          <div key={status} className="flex min-w-0 items-start gap-2.5">
            <dt className="shrink-0">
              <Badge variant={TONE_VARIANT[tone]} data-legend-status={status}>
                {label}
              </Badge>
            </dt>
            <dd className="min-w-0 text-xs leading-5 text-muted-foreground">
              {description}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * A status legend behind a "What do these statuses mean?" toggle, so it is
 * available beside a list without taking space until someone needs it.
 */
export function StatusLegendDisclosure({
  items,
  label = "What do these statuses mean?",
  className,
}: {
  items: StatusLegendItem[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className={cn("space-y-3", className)}>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="gap-1 px-0"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <RiArrowDownSLine
          aria-hidden="true"
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </Button>
      {/* A card surface, like the lists the legend explains: on the page
          background the badges would look different and lose contrast. */}
      <div id={panelId} hidden={!open}>
        {open ? (
          <StatusLegend
            items={items}
            className="rounded-xl border bg-card p-3 text-card-foreground"
          />
        ) : null}
      </div>
    </div>
  );
}
