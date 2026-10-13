export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;

  if ("status" in error) {
    const status = error.status;
    const data = "data" in error ? error.data : undefined;
    if (data && typeof data === "object" && "message" in data) {
      const message = data.message;
      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string") return message;
    }

    if (status === 409) {
      return "This request conflicts with an existing record.";
    }
    if (status === 403) {
      return "You do not have permission to perform this action.";
    }
    if (status === 401) {
      return "Your session has expired. Sign in and try again.";
    }
    if (status === "FETCH_ERROR") {
      return "Could not reach the server. Check your connection.";
    }
  } else if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

export function getApiErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return null;
}
