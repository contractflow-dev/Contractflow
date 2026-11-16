import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoMark } from "@workspace/ui/components/logo";

export function AuthTopBar() {
  return (
    <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-10">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand">
        <LogoMark variant="auto" className="size-6" />
        ContractFlow
      </p>
      <ThemeToggle />
    </div>
  );
}
