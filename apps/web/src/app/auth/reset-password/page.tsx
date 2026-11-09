import type { Metadata } from "next";
import { ResetPasswordView } from "@/features/auth/_views/reset-password-view";

// The reset link carries its token in the query string until the page
// removes it; never send this page's URL to another site.
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default ResetPasswordView;
