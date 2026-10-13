"use client";

import { useState } from "react";
import Link from "next/link";
import type { Ref } from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { LegalDocumentDialog } from "@/components/legal/legal-document-dialog";
import { PrivacyPolicyContent } from "@/components/legal/privacy-policy-content";
import { TermsOfServiceContent } from "@/components/legal/terms-of-service-content";

type LegalDocument = "terms" | "privacy";

export function LegalConsent({
  checked,
  onCheckedChange,
  onBlur,
  inputRef,
  error,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onBlur: () => void;
  inputRef: Ref<HTMLInputElement>;
  error?: string;
}) {
  const [openDocument, setOpenDocument] = useState<LegalDocument | null>(null);
  const isTermsOpen = openDocument === "terms";
  const title = isTermsOpen ? "Terms of Service" : "Privacy Policy";

  return (
    <>
      <div className="space-y-2">
        <div
          role="group"
          aria-labelledby="legal-consent-statement"
          className="flex min-w-0 items-start gap-3"
        >
          <Checkbox
            id="legal-consent"
            name="termsAccepted"
            inputRef={inputRef}
            checked={checked}
            onBlur={onBlur}
            onCheckedChange={onCheckedChange}
            required
            aria-label="I agree to the Terms of Service and acknowledge the Privacy Policy"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "legal-consent-error" : undefined}
            className="mt-1 size-5"
          />
          <p
            id="legal-consent-statement"
            className="min-w-0 text-sm leading-6 text-muted-foreground"
          >
            I agree to the{" "}
            <button
              type="button"
              onClick={() => setOpenDocument("terms")}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Terms of Service
            </button>{" "}
            and acknowledge the{" "}
            <button
              type="button"
              onClick={() => setOpenDocument("privacy")}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Privacy Policy
            </button>
            .
          </p>
        </div>
        {error && (
          <p
            id="legal-consent-error"
            role="alert"
            className="break-words ps-8 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        {/* <p className="ps-8 text-xs text-muted-foreground">
          You may also read the{" "}
          <Link
            href="/terms-of-service"
            className="underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            full Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy-policy"
            className="underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            full Privacy Policy
          </Link>
          .
        </p> */}
      </div>

      <LegalDocumentDialog
        title={title}
        description={`${title} — draft for review; bracketed details must be completed before publication.`}
        pageHref={isTermsOpen ? "/terms-of-service" : "/privacy-policy"}
        open={openDocument !== null}
        onOpenChange={(open) => {
          if (!open) setOpenDocument(null);
        }}
      >
        {isTermsOpen ? (
          <TermsOfServiceContent headingLevel="h3" />
        ) : (
          <PrivacyPolicyContent headingLevel="h3" />
        )}
      </LegalDocumentDialog>
    </>
  );
}
