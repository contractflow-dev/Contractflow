"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  RiBuilding4Line,
  RiGroupLine,
  RiSettings3Line,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { FieldLabel } from "@workspace/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { useGetCompaniesQuery } from "@/features/companies";
import { getApiErrorMessage } from "@/lib/apiError";

const links = [
  { href: "/dashboards", label: "Overview", icon: RiBuilding4Line },
  { href: "/dashboards/team", label: "Team & invitations", icon: RiGroupLine },
  {
    href: "/dashboards/profile",
    label: "Company profile",
    icon: RiSettings3Line,
  },
];

export function CompanyAdminWorkspace({
  companyId,
  activePath,
  children,
}: {
  companyId: string;
  activePath: string;
  children: (id: string) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    data: companies,
    error,
    isLoading,
    refetch,
  } = useGetCompaniesQuery(undefined, { refetchOnMountOrArgChange: true });
  const adminCompanies =
    companies?.filter(({ membership }) => membership.canManageCompany) ?? [];
  const selectedId = companyId || adminCompanies[0]?.company.id || "";
  const selectedCompany = adminCompanies.find(
    ({ company }) => company.id === selectedId,
  );

  if (isLoading) {
    return (
      <main className="grid min-h-[60vh] place-items-center p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Checking company access…
        </p>
      </main>
    );
  }
  if (error) {
    return (
      <WorkspaceNotice
        title="Unable to verify company access"
        description={getApiErrorMessage(error, "Please retry the request.")}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        }
      />
    );
  }
  if (!selectedCompany) {
    return (
      <WorkspaceNotice
        title="Company administrator access required"
        description={
          companies?.length
            ? "None of your active company memberships grants administrative access."
            : "Create a company or join one through an invitation before opening the company workspace."
        }
        action={
          !companies?.length ? (
            <Button onClick={() => router.push("/onboarding")}>
              Continue onboarding
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <RiBuilding4Line className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold">ContractFlow</p>
            <p className="truncate text-xs text-muted-foreground">
              {selectedCompany.company.name}
            </p>
          </div>
        </div>
        <nav aria-label="Company navigation" className="space-y-1 p-3">
          {links.map(({ href, label, icon: Icon }) => {
            const target = `${href}?companyId=${encodeURIComponent(selectedId)}`;
            const isActive = href === activePath;
            return (
              <Link
                key={href}
                href={target}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t p-4 text-xs text-muted-foreground">
          Administrative access is limited to this company.
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-card/90 px-4 py-2 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              Company / {links.find(({ href }) => href === activePath)?.label}
            </p>
            <h1 className="truncate text-sm font-semibold">
              {selectedCompany.company.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {adminCompanies.length > 1 && (
              <>
                <FieldLabel className="sr-only" htmlFor="company-switcher">
                  Select company
                </FieldLabel>
                <NativeSelect
                  id="company-switcher"
                  className="max-w-40 sm:max-w-56"
                  value={selectedId}
                  onChange={(event) => {
                    const next = new URLSearchParams();
                    next.set("companyId", event.target.value);
                    router.replace(`${pathname}?${next.toString()}`);
                  }}
                >
                  {adminCompanies.map(({ company }) => (
                    <NativeSelectOption key={company.id} value={company.id}>
                      {company.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </>
            )}
          </div>
          <nav
            aria-label="Company navigation"
            className="flex w-full gap-1 overflow-x-auto border-t pt-2 md:hidden"
          >
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={`${href}?companyId=${encodeURIComponent(selectedId)}`}
                aria-current={href === activePath ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs ${
                  href === activePath
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children(selectedId)}
        </main>
      </div>
    </div>
  );
}

function WorkspaceNotice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className="grid min-h-[60vh] place-items-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action && <CardFooter>{action}</CardFooter>}
      </Card>
    </main>
  );
}
