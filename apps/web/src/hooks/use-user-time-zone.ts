"use client";

import { resolveTimeZone } from "@/lib/format";
import { useGetCurrentUserQuery } from "@/services/authApi";

/**
 * The signed-in user's configured IANA time zone, for formatting timestamps.
 * Returns undefined (the browser's zone) until the profile loads or when the
 * stored zone is not supported by this browser.
 */
export function useUserTimeZone(): string | undefined {
  const { data: user } = useGetCurrentUserQuery();
  return resolveTimeZone(user?.timezone);
}
