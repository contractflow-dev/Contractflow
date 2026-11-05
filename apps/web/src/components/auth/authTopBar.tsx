import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthTopBar() {
  return (
    <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-10">
      <p className="text-sm font-semibold text-brand">ContractFlow</p>
      <ThemeToggle />
    </div>
  );
}
