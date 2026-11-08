import { createToastManager } from "@workspace/ui/components/toast";
import { getApiErrorMessage } from "@/lib/apiError";

/**
 * The application's single toast manager. `AppToastProvider` renders it, and
 * these helpers add to it from anywhere (event handlers, after a mutation).
 *
 * Use a toast to confirm an action the server has completed, or to report a
 * failure that has no field or form to show it next to. Keep field-level
 * validation and form errors inline.
 */
export const toastManager = createToastManager();

const SUCCESS_TIMEOUT_MS = 5_000;
const ERROR_TIMEOUT_MS = 8_000;

/**
 * Toasts reuse an id derived from their text, so repeating the same action
 * refreshes the existing toast instead of stacking duplicates.
 */
function toastId(type: string, title: string): string {
  return `${type}:${title}`;
}

/** Confirms an action the server has already completed. */
export function notifySuccess(title: string, description?: string): string {
  return toastManager.add({
    id: toastId("success", title),
    type: "success",
    title,
    description,
    timeout: SUCCESS_TIMEOUT_MS,
  });
}

/**
 * Reports a failed request with a readable message. The server's message is
 * used when it gives one; `fallback` covers everything else, including
 * server errors whose details must not be shown.
 */
export function notifyError(
  error: unknown,
  fallback: string,
  title = "Something went wrong",
): string {
  const description = getApiErrorMessage(error, fallback);
  return toastManager.add({
    id: toastId("error", `${title}:${description}`),
    type: "error",
    title,
    description,
    priority: "high",
    timeout: ERROR_TIMEOUT_MS,
  });
}
