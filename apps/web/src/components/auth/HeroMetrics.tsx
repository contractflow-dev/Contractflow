type Metric = {
  value: string;
  label: string;
  spokenValue?: string;
};

const METRICS: readonly Metric[] = [
  { value: "4.2 Days", label: "Avg Claim Resolution Velocity" },
  { value: "99.8%", label: "Live Compliance Visibility" },
  {
    value: "−65%",
    label: "Progressive Billing Cycle Time",
    spokenValue: "minus 65 percent",
  },
];

export function HeroMetrics({ className = "" }: { className?: string }) {
  return (
    <dl
      aria-label="Platform performance highlights"
      className={`mt-6 grid w-full max-w-xl grid-cols-1 gap-3 xl:mt-8 xl:grid-cols-3 xl:gap-5 ${className}`}
    >
      {METRICS.map((metric, index) => (
        <div
          key={metric.label}
          className="flex min-w-0 flex-col-reverse motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards motion-safe:duration-500"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <dt className="mt-1 text-xs leading-snug text-hero-muted sm:text-sm">
            {metric.label}
          </dt>

          <dd className="font-heading text-xl font-bold leading-tight tracking-tight text-brand tabular-nums sm:text-2xl xl:text-2xl">
            {metric.spokenValue ? (
              <>
                <span aria-hidden="true">{metric.value}</span>
                <span className="sr-only">{metric.spokenValue}</span>
              </>
            ) : (
              metric.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
