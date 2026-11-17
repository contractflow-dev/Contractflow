"use client";

import { useEffect, useId, useState } from "react";

/** Link with this hash to open the form directly: `/dashboards/contracts#new-contract`. */
export const NEW_CONTRACT_ANCHOR = "new-contract";

/**
 * Open state for the register's "New contract" dialog. The Overview's "Create
 * a contract" links to the register with #new-contract. On a client-side
 * navigation the page renders before the URL changes, so the hash is read just
 * after mounting, and again if it changes later.
 */
export function useNewContractForm() {
  const [open, setOpen] = useState(false);
  const formId = useId();
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === `#${NEW_CONTRACT_ANCHOR}`) setOpen(true);
    };
    const pending = window.setTimeout(openFromHash, 0);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.clearTimeout(pending);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);
  return { open, setOpen, formId };
}
