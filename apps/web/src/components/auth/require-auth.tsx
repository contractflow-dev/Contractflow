"use client";

import type { ReactNode } from "react";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Unable to verify your session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="break-words">
              <AlertDescription>
                {getApiErrorMessage(error, "Please try again in a moment.")}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              onClick={() => void refetch()}
              className="h-11 w-full"
            >
              Try again
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return user ? children : null;
}
