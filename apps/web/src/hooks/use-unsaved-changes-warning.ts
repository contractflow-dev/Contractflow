"use client";

import { useEffect } from "react";

/**
 * While `when` is true, the browser asks before the page is reloaded or the
 * tab is closed, so a half-filled form isn't lost by accident. In-app links
 * that leave a form ask through the form's own confirmation instead.
 */
export function useUnsavedChangesWarning(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers show the prompt only when returnValue is set.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [when]);
}
