"use client";

import { useSyncExternalStore } from "react";

// The server and browser can support different time zones, so the server
// renders only UTC and the browser swaps in its own list after hydration.
const serverTimezones = ["UTC"];
let browserTimezones: string[] | null = null;

/** UTC first, then every IANA time zone this browser supports. */
export function getBrowserTimezones(): string[] {
  if (!browserTimezones) {
    const supported =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    browserTimezones = [
      "UTC",
      ...supported.filter((timezone) => timezone !== "UTC"),
    ];
  }
  return browserTimezones;
}

function subscribeToTimezones() {
  return () => {};
}

/** The time zones to offer in a select, safe to render on the server. */
export function useTimeZoneOptions(): string[] {
  return useSyncExternalStore(
    subscribeToTimezones,
    getBrowserTimezones,
    () => serverTimezones,
  );
}
