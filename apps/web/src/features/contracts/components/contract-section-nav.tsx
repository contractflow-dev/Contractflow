"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  CONTRACT_SECTIONS,
  contractSectionHref,
  isRestrictedContractSection,
  type ContractSection,
  type RestrictedContractSection,
} from "../contract-sections";

/**
 * The section chosen from this nav, kept across the navigation: each section
 * is its own page, so the link that had focus is replaced. The new page's nav
 * moves focus to its current tab, so keyboard users stay in the tab strip.
 */
let pendingFocus: ContractSection | null = null;

/**
 * Links to the contract's sections. Each section is its own page, so these
 * are links marked with aria-current, not an ARIA tab widget.
 */
export function ContractSectionNav({
  contractId,
  current,
  access,
}: {
  contractId: string;
  current: ContractSection;
  access: Record<RestrictedContractSection, boolean | undefined>;
}) {
  const currentLink = useRef<HTMLAnchorElement>(null);
  const sections = CONTRACT_SECTIONS.filter(
    ({ id }) =>
      id === current || !isRestrictedContractSection(id) || access[id] === true,
  );

  useEffect(() => {
    if (pendingFocus !== current) return;
    pendingFocus = null;
    currentLink.current?.focus({ preventScroll: true });
  }, [current]);

  return (
    // The strip scrolls on its own on narrow screens, never the page.
    <nav aria-label="Contract sections" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b">
        {sections.map(({ id, label }) => {
          const active = id === current;
          return (
            <li key={id}>
              <Link
                ref={active ? currentLink : undefined}
                href={contractSectionHref(contractId, id)}
                aria-current={active ? "page" : undefined}
                scroll={false}
                onClick={() => {
                  pendingFocus = id;
                }}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center rounded-t-xl border-b-2 px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
