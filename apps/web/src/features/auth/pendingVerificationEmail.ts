/**
 * The address a verification email was just sent to (after registering) or
 * is needed for (after signing in unverified), so "Check your inbox" can say
 * where it went and resend without retyping. Kept in sessionStorage — this
 * tab only, cleared when it closes — and never in the URL. Holds only the
 * email address: never a password or token.
 */
const STORAGE_KEY = "contractflow.pendingVerificationEmail";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Storage can be blocked (private mode, site data disabled).
    return null;
  }
}

export function rememberPendingVerificationEmail(email: string): void {
  try {
    storage()?.setItem(STORAGE_KEY, email.trim().toLowerCase());
  } catch {
    // Without storage the user simply types the address again.
  }
}

export function readPendingVerificationEmail(): string | null {
  try {
    return storage()?.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function forgetPendingVerificationEmail(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** "ada@example.com" → "a•••@example.com", enough to recognise, not to copy. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}
