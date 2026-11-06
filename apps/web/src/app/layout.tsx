import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/store/provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { themeInitScript } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: "Contractflow",
  description: "Contractflow",
};

// Loaded as a stylesheet at runtime: next/font/google downloads fonts at build
// time, which broke the Turbopack build (see commit 43795a6).
const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={
        {
          "--font-ibm-plex-sans": "'IBM Plex Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          "--font-outfit": "Outfit, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          "--font-geist-mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        } as React.CSSProperties
      }
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body>
        <StoreProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
