"use client";

import type { ReactNode } from "react";
import { Toaster, ToastProvider } from "@workspace/ui/components/toast";
import { toastManager } from "@/lib/notify";

/** Renders toasts added through `notifySuccess` and `notifyError`. */
export function AppToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider toastManager={toastManager} limit={3}>
      {children}
      <Toaster />
    </ToastProvider>
  );
}
