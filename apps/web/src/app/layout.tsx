import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/store/provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: "Contractflow",
  description: "Contractflow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      style={
        {
          "--font-ibm": "'IBM Plex Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          "--font-outfit": "Outfit, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          "--font-geist-mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        } as React.CSSProperties
      }
    >
      <body>
        <StoreProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}