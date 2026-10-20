import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { buttonVariants } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@/lib/utils";

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
          className={cn(buttonVariants({ variant: "link" }), "h-11 px-0")}
        >
          Back to registration
        </Link>

        <header className="space-y-3 pb-3">
          <p className="text-sm font-semibold text-primary">ContractFlow</p>
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective date: <strong>[To be set before publication]</strong>
            <span aria-hidden="true"> · </span>
            Last updated: <strong>[To be set before publication]</strong>
          </p>
          <Separator className="mt-3" />
        </header>

        <Alert role="note">
          <AlertDescription className="leading-6">
            Draft for service-owner and legal review. Complete every bracketed
            placeholder and confirm the statements against the production service
            before publishing. This document is not legal advice or a guarantee
            of compliance with any law.
          </AlertDescription>
        </Alert>

        {children}
      </article>
    </main>
  );
}
