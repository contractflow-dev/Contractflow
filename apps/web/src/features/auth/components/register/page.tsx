import { RegisterForm } from "@/features/auth/components/register-form";
import { HeroMetrics } from "@/components/auth/HeroMetrics";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function RegisterPage() {
  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold tracking-tight">
              ContractFlow
            </span>
            <ThemeToggle />
          </div>
          <RegisterForm />
        </div>
      </section>

      <aside className="relative hidden min-w-0 flex-col justify-between bg-auth-hero bg-cover bg-center p-10 text-white lg:sticky lg:top-0 lg:flex lg:min-h-svh lg:self-start">
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
        <span className="relative z-10 text-lg font-semibold tracking-tight">
          ContractFlow
        </span>
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight">
              Every contract, from tender to close-out, in one place.
            </h2>
            <p className="max-w-md text-sm text-white/80">
              Track vendors, approvals, milestones and obligations across your
              oil and gas operations.
            </p>
          </div>
          <HeroMetrics className="mt-4 gap-8 xl:mt-2 xl:gap-1" />
          <p className="text-xs text-white/70">
            &copy; {new Date().getFullYear()} ContractFlow
          </p>
        </div>
      </aside>
    </main>
  );
}
