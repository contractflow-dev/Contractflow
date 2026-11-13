"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CircleCheck,
  Clock,
  LogOut,
  MailX,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import {
  EInvitationStatus,
  type ECompanyRole,
} from "@contractflow/contracts-schema";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useLogoutMutation } from "@/services/authApi";
import { useAppDispatch } from "@/store/hooks";
import {
  clearSignedOutClientState,
  completeSignOut,
} from "@/features/auth/signOut";

/** The page frame every invitation screen shares. */
export function InvitationLayout({
  icon: Icon,
  tone = "default",
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning";
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4 sm:p-6">
      <Card className="w-full max-w-lg rounded-xl">
        <CardHeader className="space-y-4">
          <p className="text-sm font-semibold text-primary">ContractFlow</p>
          {Icon && (
            <div
              className={cn(
                "grid size-11 place-items-center rounded-full",
                tone === "success" &&
                  "bg-success-soft text-success-soft-foreground",
                tone === "warning" &&
                  "bg-warning-soft text-warning-soft-foreground",
                tone === "default" && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
          )}
          <div className="space-y-2">
            <CardTitle>
              <h1 className="type-page-title">{title}</h1>
            </CardTitle>
            {description && (
              <CardDescription className="text-sm leading-6">
                {description}
              </CardDescription>
            )}
          </div>
        </CardHeader>
        {children && (
          <CardContent className="space-y-5">{children}</CardContent>
        )}
      </Card>
    </main>
  );
}

/** Who invited whom, to which company and role, and until when. */
export function InvitationDetails({
  companyName,
  inviterName,
  email,
  companyRole,
  expiresAt,
}: {
  companyName: string;
  inviterName: string | null;
  email: string;
  companyRole: ECompanyRole;
  expiresAt: string;
}) {
  const rows: Array<[string, string]> = [
    ["Company", companyName],
    ...(inviterName ? [["Invited by", inviterName] as [string, string]] : []),
    ["Invited email", email],
    ["Company role", companyRole],
    ["Expires", formatDateTime(expiresAt)],
  ];
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What joining gives, said before the user accepts. */
export function MembershipScopeNote() {
  return (
    <p className="text-sm leading-6 text-muted-foreground">
      Accepting makes you a member of this company with the role above. You
      won&apos;t have access to any contract until a Company Administrator
      assigns you to one.
    </p>
  );
}

const CLOSED_STATUS: Record<
  Exclude<EInvitationStatus, EInvitationStatus.PENDING>,
  { icon: LucideIcon; title: string; description: string }
> = {
  [EInvitationStatus.ACCEPTED]: {
    icon: CircleCheck,
    title: "Invitation already accepted",
    description:
      "This invitation has already been accepted. Sign in with the invited email address to open the company.",
  },
  [EInvitationStatus.DECLINED]: {
    icon: MailX,
    title: "Invitation declined",
    description:
      "This invitation was declined. If that was a mistake, ask the company administrator to send a new one.",
  },
  [EInvitationStatus.EXPIRED]: {
    icon: Clock,
    title: "This invitation has expired",
    description:
      "Invitations are valid for 7 days. Ask the company administrator to send you a new invitation.",
  },
  [EInvitationStatus.REVOKED]: {
    icon: Ban,
    title: "This invitation was withdrawn",
    description:
      "The company administrator revoked this invitation, so it can no longer be accepted. Contact them if you still need access.",
  },
};

/** An invitation that can no longer be answered. */
export function ClosedInvitation({
  status,
}: {
  status: Exclude<EInvitationStatus, EInvitationStatus.PENDING>;
}) {
  const { icon, title, description } = CLOSED_STATUS[status];
  return (
    <InvitationLayout
      icon={icon}
      tone={status === EInvitationStatus.ACCEPTED ? "success" : "warning"}
      title={title}
      description={description}
    >
      <HomeLinks />
    </InvitationLayout>
  );
}

/** A link that isn't a ContractFlow invitation, or no longer exists. */
export function InvalidInvitation({ message }: { message?: string }) {
  return (
    <InvitationLayout
      icon={SearchX}
      tone="warning"
      title="We couldn't find this invitation"
      description={
        message ??
        "The link may be incomplete or mistyped. Open the full link from your invitation email, or ask the company administrator to send a new one."
      }
    >
      <HomeLinks />
    </InvitationLayout>
  );
}

function HomeLinks() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "outline" }), "sm:flex-1")}
      >
        Sign in
      </Link>
      <Link
        href="/dashboards"
        className={cn(buttonVariants({ variant: "ghost" }), "sm:flex-1")}
      >
        Go to ContractFlow
      </Link>
    </div>
  );
}

/** Shown once the user is a member: the dashboard is the next step. */
export function JoinedCompany({
  companyName,
  companyRole,
  onContinue,
}: {
  companyName: string;
  companyRole: ECompanyRole;
  onContinue: () => void;
}) {
  return (
    <InvitationLayout
      icon={CircleCheck}
      tone="success"
      title={`You've joined ${companyName}`}
      description={`You're now a member with the ${companyRole} role.`}
    >
      <p className="text-sm leading-6 text-muted-foreground">
        A Company Administrator will assign you to contracts and workspaces.
        They&apos;ll appear on your dashboard once you&apos;re assigned.
      </p>
      <Button size="xl" className="w-full" onClick={onContinue} autoFocus>
        Go to {companyName}
      </Button>
    </InvitationLayout>
  );
}

/**
 * Signs out and returns to sign-in, then back to `returnTo`, so the right
 * account can answer an invitation sent to another address.
 */
export function SwitchAccountButton({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logout] = useLogoutMutation();
  const started = useRef(false);
  const [pending, setPending] = useState(false);

  async function switchAccount() {
    if (started.current) return;
    started.current = true;
    setPending(true);
    await completeSignOut(
      () => logout().unwrap(),
      () => clearSignedOutClientState(dispatch),
      (href) =>
        router.replace(
          href === "/login"
            ? `/login?redirect=${encodeURIComponent(returnTo)}`
            : href,
        ),
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() => void switchAccount()}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {pending ? "Signing out…" : "Sign out and use the invited email"}
    </Button>
  );
}
