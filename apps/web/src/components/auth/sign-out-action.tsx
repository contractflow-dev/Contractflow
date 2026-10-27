"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import { useLogoutMutation } from "@/services/authApi";
import { useAppDispatch } from "@/store/hooks";
import {
  clearSignedOutClientState,
  completeSignOut,
} from "@/features/auth/signOut";
import { cn } from "@/lib/utils";

interface SignOutActionProps {
  presentation?: "button" | "menu-item";
  className?: string;
}

export function SignOutAction({
  presentation = "button",
  className,
}: SignOutActionProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const requestInFlight = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [logout, { isLoading }] = useLogoutMutation();

  async function handleSignOut() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setHasStarted(true);

    await completeSignOut(
      () => logout().unwrap(),
      () => clearSignedOutClientState(dispatch),
      (href) => router.replace(href),
    );
  }

  const isDisabled = isLoading || hasStarted;
  const label = isDisabled ? "Signing out…" : "Sign out";
  const icon = <LogOut className="size-4" aria-hidden="true" />;

  if (presentation === "menu-item") {
    return (
      <DropdownMenuItem
        disabled={isDisabled}
        onClick={() => void handleSignOut()}
        className={cn(
          "cursor-pointer text-muted-foreground focus:text-destructive",
          className,
        )}
        aria-label="Sign out of ContractFlow"
      >
        {icon}
        {label}
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void handleSignOut()}
      disabled={isDisabled}
      className={cn(
        "gap-1.5 text-xs text-muted-foreground hover:border-destructive/30 hover:text-destructive",
        className,
      )}
      title="Sign out of ContractFlow"
      aria-label="Sign out of ContractFlow"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
