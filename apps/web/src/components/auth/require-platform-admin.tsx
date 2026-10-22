"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiShieldCrossLine,
  RiArrowRightLine,
  RiLogoutBoxRLine,
  RiLoader4Line,
} from "@remixicon/react";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { useGetCurrentUserQuery, useLogoutMutation } from "@/services/authApi";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@/lib/utils";

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: user, error, isFetching, refetch } = useGetCurrentUserQuery(
    undefined,
    { refetchOnMountOrArgChange: true },
  );
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const isUnauthorized = getApiErrorStatus(error) === 401;

  useEffect(() => {
    if (isUnauthorized) router.replace("/login");
  }, [isUnauthorized, router]);

  if (isUnauthorized) {
    return (
      <main className="grid min-h-svh place-items-center p-6 bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RiLoader4Line className="size-5 animate-spin text-brand" />
          <span>Redirecting to sign in…</span>
        </div>
      </main>
    );
  }

  if (isFetching || (!user && !error)) {
    return (
      <main className="grid min-h-svh place-items-center p-6 bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <RiLoader4Line className="size-8 animate-spin text-brand" />
          <p className="text-sm font-medium text-foreground">
            Verifying platform administrator authorization…
          </p>
          <p className="text-xs text-muted-foreground">
            Connecting to ContractFlow platform control plane
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-svh place-items-center p-4 sm:p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Unable to verify authorization
            </CardTitle>
            <CardDescription>
              The platform could not complete your security verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(error, "Please check your network and try again.")}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              onClick={() => void refetch()}
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              Retry authorization check
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Deny access if user is not a platform administrator
  if (!user?.isPlatformAdmin) {
    return (
      <main className="grid min-h-svh place-items-center p-4 sm:p-6 bg-background">
        <Card className="w-full max-w-lg border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <RiShieldCrossLine className="size-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Platform Admin Access Required
                </CardTitle>
                <CardDescription className="text-xs">
                  HTTP 403 Forbidden — Restricted Resource
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p>
                Your account (<strong className="text-foreground">{user?.email}</strong>) is not authorized to access the ContractFlow Platform Administration dashboard.
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground/90">
                <strong>Notice on Role Separation:</strong> Company administrator and member roles are strictly scoped to individual tenant companies and do not confer global platform privileges.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={async () => {
                await logout().unwrap();
                router.replace("/login");
              }}
              disabled={isLoggingOut}
              className="gap-2"
            >
              <RiLogoutBoxRLine className="size-4" />
              Sign out
            </Button>
            <Link
              href="/dashboards"
              className={cn(
                buttonVariants({ variant: "default" }),
                "gap-2 bg-brand text-brand-foreground hover:bg-brand/90",
              )}
            >
              Go to Company Dashboard
              <RiArrowRightLine className="size-4" />
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}
