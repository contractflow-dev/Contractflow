"use client";

import type { ReactNode } from "react";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { useGetCurrentUserQuery } from "@/services/authApi";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, error, isFetching, refetch } = useGetCurrentUserQuery(
    undefined,
    { refetchOnMountOrArgChange: true },
  );
  const isUnauthorized = getApiErrorStatus(error) === 401;

  if (isUnauthorized || isFetching || (!user && !error)) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Checking your session…
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-svh place-items-center p-4 sm:p-6">
        <section className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold">Unable to verify your session</h1>
          <p role="alert" className="break-words text-sm text-destructive">
            {getApiErrorMessage(error, "Please try again in a moment.")}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return user ? children : null;
}
