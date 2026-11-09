/** `?reason=` on /login when a signed-in session stopped working. */
export const SESSION_EXPIRED_REASON = "session-expired";

const DEFAULT_DESTINATION = "/dashboards";

/** A same-site path, never a protocol-relative or absolute URL. */
function isLocalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

/**
 * The sign-in page URL for someone sent away from `currentPath` because the
 * API no longer accepts their session. `expired` says whether they had been
 * signed in on this page, so the page can say the session expired rather
 * than just asking them to sign in.
 */
export function signInUrl(
  currentPath: string,
  { expired }: { expired: boolean },
): string {
  const params = new URLSearchParams();
  if (expired) params.set("reason", SESSION_EXPIRED_REASON);
  if (isLocalPath(currentPath) && !currentPath.startsWith("/login")) {
    params.set("redirect", currentPath);
  }
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/**
 * Where to go after signing in: the requested page when it is on this site
 * (and not the sign-in page itself), otherwise the dashboards.
 */
export function safeRedirectPath(
  requested: string | null,
  origin: string,
): string {
  if (!requested || !isLocalPath(requested)) return DEFAULT_DESTINATION;
  let url: URL;
  try {
    url = new URL(requested, origin);
  } catch {
    return DEFAULT_DESTINATION;
  }
  if (url.origin !== origin || url.pathname.startsWith("/login")) {
    return DEFAULT_DESTINATION;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
