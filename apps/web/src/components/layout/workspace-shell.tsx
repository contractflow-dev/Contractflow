"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  RiDashboardLine,
  RiFileList3Line,
  RiGroupLine,
  RiSettings3Line,
  RiQuestionLine,
  RiArrowDownSLine,
  RiBriefcaseLine,
  RiSearchLine,
  RiCheckboxCircleFill,
  RiCalendarLine,
  RiBarChart2Line,
  RiFileTextLine,
} from "@remixicon/react";

type DepartmentKey = "Contractor" | "Client Project Mgmt" | "HSE" | "Finance";

const departmentMeta: Record<
  DepartmentKey,
  { dot: string; accent: string; tint: string; label: string }
> = {
  Contractor: {
    dot: "#D9622A",
    accent: "#D9622A",
    tint: "#FCEEE6",
    label: "Contractor",
  },
  "Client Project Mgmt": {
    dot: "#5B9BD5",
    accent: "#5B9BD5",
    tint: "#EAF2FB",
    label: "Client Project Mgmt",
  },
  HSE: {
    dot: "#2F7D5C",
    accent: "#2F7D5C",
    tint: "#E8F3EE",
    label: "HSE",
  },
  Finance: {
    dot: "#B8860B",
    accent: "#B8860B",
    tint: "#FBF3DE",
    label: "Finance",
  },
};

export function BrandMark({ className = "size-4" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-[linear-gradient(135deg,#ef7c43,#d9622a)] ${className}`}
      aria-hidden="true"
    >
      <span className="block h-2.5 w-2.5 rounded-[3px] border border-white/80 bg-white/10" />
    </span>
  );
}

export function WorkspaceSidebar({
  currentPage = "Dashboard",
  title = "Acme Energy Corp",
}: {
  currentPage?: string;
  title?: string;
}) {
  const navItems = [
    { label: "Dashboard", icon: RiDashboardLine },
    { label: "Contracts", icon: RiFileList3Line },
    { label: "Tasks", icon: RiBriefcaseLine },
    { label: "Calendar", icon: RiCalendarLine },
    { label: "Reports", icon: RiBarChart2Line },
  ];

  return (
    <aside className="flex h-screen w-[264px] shrink-0 flex-col bg-[#070B16] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 pb-3 pt-4">
        <BrandMark className="size-5 rounded-[6px]" />
        <div className="font-[family-name:var(--font-outfit)] text-[17px] font-extrabold tracking-[-0.04em]">
          ContractFlow
        </div>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#152741] px-3 py-2.5 text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md bg-[#5B9BD5]/20 text-[11px] font-semibold text-white">
              AE
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-white">
                {title}
              </div>
            </div>
          </div>
          <RiArrowDownSLine className="size-4 text-white/80" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 pb-4 pt-3">
        {navItems.map(({ label, icon: Icon }) => {
          const active = label === currentPage;
          return (
            <Link
              key={label}
              href="#"
              className={[
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[#152741] text-white shadow-[inset_2px_0_0_#d9622a]"
                  : "text-[#B8C2D1] hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <Icon className="size-[18px]" />
              <span>{label}</span>
            </Link>
          );
        })}

        <div className="px-2 pb-1 pt-5">
          <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A93A1]">
            Department workspaces
          </div>
        </div>

        <div className="space-y-1">
          {(Object.keys(departmentMeta) as DepartmentKey[]).map((department) => {
            const meta = departmentMeta[department];
            return (
              <Link
                key={department}
                href="#"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-[#B8C2D1] transition-colors hover:bg-white/5 hover:text-white"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: meta.dot }}
                  aria-hidden="true"
                />
                <span>{department}</span>
              </Link>
            );
          })}
        </div>

        <div className="my-3 h-px bg-white/10" />

        <Link
          href="#"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-[#B8C2D1] hover:bg-white/5 hover:text-white"
        >
          <RiGroupLine className="size-[18px]" />
          Team
        </Link>
        <Link
          href="#"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-[#B8C2D1] hover:bg-white/5 hover:text-white"
        >
          <RiSettings3Line className="size-[18px]" />
          Settings
        </Link>
      </nav>

      <div className="mt-auto border-t border-white/10 px-3 py-3">
        <Link
          href="#"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-[#B8C2D1] hover:bg-white/5 hover:text-white"
        >
          <RiQuestionLine className="size-[18px]" />
          Help & Support
        </Link>
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/3 px-2.5 py-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#EFE6DE] text-[11px] font-semibold text-[#493121]">
            M
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">Mark Jenkins</div>
            <div className="truncate text-[11px] text-[#B8C2D1]">Workspace Owner</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function WorkspaceTopBar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-outfit)] text-[23px] font-semibold tracking-[-0.04em] text-[#101828]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[13px] leading-6 text-[#5B6472]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function WorkspaceToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-2.5">
      {children}
    </div>
  );
}

export function SearchField({ placeholder = "Search..." }: { placeholder?: string }) {
  return (
    <label className="relative block min-w-[200px] flex-1">
      <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8A93A1]" />
      <input
        className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] pl-9 pr-3 text-[13px] text-[#101828] outline-none placeholder:text-[#8A93A1]"
        placeholder={placeholder}
      />
    </label>
  );
}

export function SelectField({ value, children }: { value: string; children: ReactNode }) {
  return (
    <div className="relative min-w-[120px]">
      <select className="h-10 appearance-none rounded-lg border border-[#E5E7EB] bg-white px-3 pr-8 text-[13px] text-[#101828] outline-none">
        {children}
      </select>
      <RiArrowDownSLine className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#667085]" />
    </div>
  );
}

export function SegmentedToggle({
  options,
  value,
}: {
  options: string[];
  value: string;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={[
            "rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
            value === option
              ? "bg-white text-[#101828] shadow-sm ring-1 ring-[#E5E7EB]"
              : "text-[#667085]",
          ].join(" ")}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function EmptyContractState() {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center">
      <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[#8A93A1]">
        <RiFileTextLine className="size-5" />
      </div>
      <h3 className="text-[19px] font-semibold text-[#101828]">No contracts yet</h3>
      <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[#667085]">
        Once created, a contract&apos;s stage, compliance status, and milestones will show here and roll up into every department workspace automatically.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#D9622A] px-4 text-[13px] font-medium text-white hover:bg-[#c95d2c]">
          Create Contract
        </button>
        <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white px-4 text-[13px] font-medium text-[#101828] hover:bg-[#F5F5F5]">
          Import Contract
        </button>
      </div>
    </div>
  );
}

export function InfoStrip({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-[#F2D5B7] bg-[#FCEEE6] px-4 py-3 text-[12px] text-[#B94F1F]">
      {children}
    </div>
  );
}

export function StatusBadge({ color = "#E9D8FD", label = "Active" }: { color?: string; label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: color, color: "#1F2937" }}
    >
      {label}
    </span>
  );
}

export function EmptyTaskState() {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 text-center">
      <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-full bg-[#EFF6FF] text-[#4F46E5]">
        <RiCheckboxCircleFill className="size-4" />
      </div>
      <p className="text-[13px] leading-6 text-[#5B6472]">
        No contract-generated tasks yet. Create contracts and start your workflow to keep everything moving.
      </p>
    </div>
  );
}

export function EmptyReportsState() {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-[#F5F5F5] text-[#8A93A1]">
        <RiBarChart2Line className="size-5" />
      </div>
      <p className="text-[13px] leading-6 text-[#5B6472]">
        Reports will appear here once your contracts start moving through the lifecycle.
      </p>
    </div>
  );
}

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <h3 className="mb-4 text-[17px] font-semibold text-[#101828]">{title}</h3>
      {children}
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-[#344054]">{label}</label>
      {children}
    </div>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f4f7] text-[#101828]">
      <div className="flex min-h-screen">
        <WorkspaceSidebar />
        <main className="min-w-0 flex-1 overflow-auto bg-[#F6F7F9] px-6 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function SimplePageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="flex min-h-screen">
        <WorkspaceSidebar />
        <main className="min-w-0 flex-1 overflow-auto px-6 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
