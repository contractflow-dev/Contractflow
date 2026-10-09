import Image from "next/image";
import { RiFileList3Line } from "@remixicon/react";
import { RegisterForm } from "@/features/auth/components/register-form";

const stats = [
  { value: "4.2 Days", label: "Avg Claim Resolution Velocity" },
  { value: "99.8%", label: "Live Compliance Visibility" },
  { value: "-65%", label: "Progressive Billing Cycle Time" },
];

export default function RegisterPage() {
  return (
    <main className="dark grid min-h-svh bg-background text-foreground lg:grid-cols-[380px_1fr]">
      {/* Left: form panel */}
      <section className="flex flex-col gap-6 overflow-y-auto border-e bg-card p-8">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <RiFileList3Line className="size-4" />
          </div>
          <span className="font-heading font-semibold">ContractFlow</span>
        </div>

        <RegisterForm />

        <p className="mt-auto border-t pt-4 text-[10px] text-muted-foreground">
          SOC 2 Type II Certified • ISO 29001 Energy Standard Compliant
        </p>
      </section>

      {/* Right: hero */}
      <section className="relative hidden lg:block">
        <Image
          src="/images/auth-hero.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) calc(100vw - 380px), 0px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-background/20" />

        <div className="absolute inset-x-12 bottom-10 max-w-2xl">
          <h2 className="font-heading text-4xl font-bold leading-tight">
            Unifying trust and execution across heavy infrastructure.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Stop searching for who is holding up project progress. Resolve
            compliance blocks, progressive milestone claims, and audits inside a
            single unalterable operational ledger.
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-heading text-2xl font-bold text-chart-1">
                  {s.value}
                </dt>
                <dd className="text-xs text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
