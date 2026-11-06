"use client";

import { useState } from "react";
import type { ICompanyProfileResponse } from "@contractflow/contracts-schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { getApiErrorMessage } from "@/lib/apiError";
import { useResendCompanyVerificationEmailMutation } from "@/services/companiesApi";

/**
 * Shown to company administrators until the company email is verified.
 * Other companies can only invite a verified company to their contracts.
 */
export function CompanyVerificationNotice({
  company,
}: {
  company: Pick<ICompanyProfileResponse, "id" | "email" | "verifiedAt">;
}) {
  const [resend, { isLoading }] = useResendCompanyVerificationEmailMutation();
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  if (company.verifiedAt) return null;

  async function resendLink() {
    setFeedback(null);
    try {
      const response = await resend({ companyId: company.id }).unwrap();
      setFeedback({ tone: "success", message: response.message });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getApiErrorMessage(
          error,
          "The verification link could not be sent. Please try again.",
        ),
      });
    }
  }

  return (
    <Alert className="border-warning/40 bg-warning-soft">
      <AlertTitle>Verify your company email</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Other companies can only invite your company to their contracts after
          you confirm <span className="font-medium">{company.email}</span>. Open
          the link we sent to that address.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => void resendLink()}
          >
            {isLoading ? "Sending…" : "Send a new link"}
          </Button>
          {feedback && (
            <span
              role={feedback.tone === "error" ? "alert" : "status"}
              className={
                feedback.tone === "error" ? "text-destructive" : undefined
              }
            >
              {feedback.message}
            </span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
