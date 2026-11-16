"use client";

import { useSyncExternalStore, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/utils";

type FlagComponent = ComponentType<SVGProps<SVGSVGElement>>;
type FlagSet = Readonly<Record<string, FlagComponent | undefined>>;

/*
 * Flags are SVG components from `country-flag-icons` (MIT), rendered the
 * same in every browser, unlike emoji flags (Windows shows letters instead).
 * The full set is ~180 KB, so it loads as its own chunk the first time a flag
 * is shown, and pages without one never download it.
 */
let flags: FlagSet | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadFlags(): Promise<void> {
  loading ??= import("country-flag-icons/react/3x2")
    .then((module) => {
      flags = module as unknown as FlagSet;
      listeners.forEach((listener) => listener());
    })
    .catch(() => {
      // Keep the neutral placeholder; a later flag may retry.
      loading = null;
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!flags) void loadFlags();
  return () => {
    listeners.delete(listener);
  };
}

const getFlags = () => flags;
const getServerFlags = () => null;

/**
 * A country's flag at 3:2, decorative (the country is always named in text
 * nearby). Shows a neutral placeholder of the same size while the flags load
 * or for a code without a flag.
 */
export function CountryFlag({
  countryCode,
  className,
}: {
  countryCode: string;
  className?: string;
}) {
  const set = useSyncExternalStore(subscribe, getFlags, getServerFlags);
  const Flag = countryCode ? set?.[countryCode.toUpperCase()] : undefined;

  return (
    <span
      aria-hidden="true"
      data-slot="country-flag"
      data-country={countryCode || undefined}
      className={cn(
        "inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] bg-muted ring-1 ring-foreground/10",
        className,
      )}
    >
      {Flag ? <Flag className="size-full" focusable="false" /> : null}
    </span>
  );
}
