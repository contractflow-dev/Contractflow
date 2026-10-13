import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocumentPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <article className="mx-auto w-full max-w-3xl space-y-7">
        <Link
          href="/auth/register"
          className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to registration
        </Link>

        <header className="space-y-3 border-b pb-6">
          <p className="text-sm font-semibold text-primary">ContractFlow</p>
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective date: <strong>[To be set before publication]</strong>
            <span aria-hidden="true"> · </span>
            Last updated: <strong>[To be set before publication]</strong>
          </p>
        </header>

        <aside
          role="note"
          className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground"
        >
          Draft for service-owner and legal review. Complete every bracketed
          placeholder and confirm the statements against the production service
          before publishing. This document is not legal advice or a guarantee
          of compliance with any law.
        </aside>

        {children}
      </article>
    </main>
  );
}
