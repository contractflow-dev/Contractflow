import * as React from "react";
import { cn } from "cn";

const BRAND_ORANGE = "#C24B0B";
const BRAND_NAVY = "#0A2139";

// Traced from the ContractFlow brand mark (197 × 163 artboard).
const ARC_PATH =
  "M68 0H148C156 0 161 6 157 12L126 43H66L48 58Q40 66 40 78V94Q40 98 37 101L15 120Q12 122.5 9.5 119.5C3 112 0 104 0 94V68C0 58 3 51 9 44L40 12C48 4 56 0 68 0Z";
const UPPER_BAR_PATH =
  "M112 56H187C196 56 199 64 193 71L171 94C169 97 168 98.5 165 98.5H84C76 98.5 72 89 77 84L103 58C105 56.6 108 56 112 56Z";
const LOWER_BAR_PATH =
  "M48 110C52 110 58 114 62 118Q66 120 72 120H92Q98 120 102 114C104 111.5 106 111 109 111H142C148 111 151 116 147 120L113 154Q105 162 97 161.5H62C55 161.5 51 160 48 157L28 137C24 133 24.5 131.5 28 129L44 114C45 111.5 46.5 110 48 110Z";

type LogoMarkVariant =
  /** Orange + navy. For light backgrounds. */
  | "color"
  /** Orange + white. For dark or brand-coloured backgrounds. */
  | "inverse"
  /** Orange + navy in light mode, orange + white under `.dark`. */
  | "auto"
  /** Single colour, inherits `currentColor` (e.g. `text-primary`). */
  | "mono";

type LogoMarkProps = Omit<React.ComponentProps<"svg">, "children"> & {
  variant?: LogoMarkVariant;
  /** Accessible name. When omitted the mark is treated as decorative. */
  title?: string;
};

function LogoMark({
  variant = "color",
  title,
  className,
  ...props
}: LogoMarkProps) {
  const titleId = React.useId();

  const arcFill = variant === "mono" ? "currentColor" : BRAND_ORANGE;
  const barFill =
    variant === "mono"
      ? "currentColor"
      : variant === "inverse"
        ? "#FFFFFF"
        : variant === "auto"
          ? undefined
          : BRAND_NAVY;

  return (
    <svg
      data-slot="logo-mark"
      data-variant={variant}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 197 163"
      fill="none"
      role={title ? "img" : undefined}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <path d={ARC_PATH} fill={arcFill} />
      <g
        fill={barFill}
        className={
          variant === "auto" ? "fill-[#0A2139] dark:fill-white" : undefined
        }
      >
        <path d={UPPER_BAR_PATH} />
        <path d={LOWER_BAR_PATH} />
      </g>
    </svg>
  );
}

export { LogoMark, BRAND_ORANGE, BRAND_NAVY };
export type { LogoMarkProps, LogoMarkVariant };
