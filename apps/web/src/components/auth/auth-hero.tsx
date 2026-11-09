import { cn } from "@/lib/utils";
import { HeroMetrics } from "./HeroMetrics";

const IMAGE_CLASS = {
  auth: "bg-auth-hero",
  register: "bg-reg-hero",
} as const;

/**
 * The photo panel beside the form on authentication and onboarding screens,
 * shown from the `lg` breakpoint. It uses the hero tokens, which stay dark in
 * both themes so the text over the photo is always readable.
 */
export function AuthHero({
  image = "auth",
}: {
  image?: keyof typeof IMAGE_CLASS;
}) {
  return (
    <aside
      className={cn(
        "relative hidden min-w-0 flex-col justify-between overflow-hidden bg-cover bg-center p-10 text-hero-foreground lg:sticky lg:top-0 lg:flex lg:min-h-svh lg:self-start",
        IMAGE_CLASS[image],
      )}
    >
      <div className="absolute inset-0 bg-hero-overlay" aria-hidden="true" />

      <span className="relative z-10 text-lg font-semibold tracking-tight">
        ContractFlow
      </span>

      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight">
            Every contract, from tender to close-out, in one place.
          </h2>
          <p className="max-w-md text-sm text-hero-muted">
            Track vendors, approvals, milestones and obligations across your oil
            and gas operations.
          </p>
        </div>
        <HeroMetrics className="mt-4 gap-8 xl:mt-2 xl:gap-1" />
        <p className="text-xs text-hero-muted">
          &copy; {new Date().getFullYear()} ContractFlow
        </p>
      </div>
    </aside>
  );
}
