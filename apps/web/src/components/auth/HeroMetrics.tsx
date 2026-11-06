import { cn } from "@/lib/utils";

type Highlight = {
  title: string;
  description: string;
};

// Product capabilities, not performance figures: there is no measured data to
// back statistics here, so none are shown.
const HIGHLIGHTS: readonly Highlight[] = [
  {
    title: "One register",
    description: "Contracts, parties and status in one place",
  },
  {
    title: "Role-based access",
    description: "Access follows company membership and contract roles",
  },
  {
    title: "Full history",
    description: "Every status change is recorded with its reason",
  },
];

export function HeroMetrics({ className = "" }: { className?: string }) {
  return (
    <dl
      aria-label="ContractFlow highlights"
      className={cn(
        "mt-6 grid w-full max-w-xl grid-cols-1 gap-3 xl:mt-8 xl:grid-cols-3 xl:gap-6",
        className,
      )}
    >
      {HIGHLIGHTS.map((highlight, index) => (
        <div
          key={highlight.title}
          className="flex min-w-0 flex-col justify-start text-left motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards motion-safe:duration-500"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <dt className="font-heading text-lg font-bold leading-tight tracking-tight text-hero-accent sm:text-xl">
            {highlight.title}
          </dt>
          <dd className="mt-1 text-xs font-medium leading-snug text-hero-foreground text-pretty sm:text-sm">
            {highlight.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}
