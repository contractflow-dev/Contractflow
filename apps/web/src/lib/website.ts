import { z } from "zod";

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/** Prefixes `https://` when the user omits a scheme (e.g. `www.example.com`). */
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || HAS_SCHEME.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Optional website field: empty string, or an http(s) URL with a domain. */
export const websiteSchema = z
  .string()
  .transform(normalizeWebsite)
  .pipe(
    z.union([
      z.literal(""),
      z
        .url({
          protocol: /^https?$/,
          hostname: z.regexes.domain,
          error: "Enter a valid website, e.g. www.example.com",
        })
        .max(255),
    ]),
  );
