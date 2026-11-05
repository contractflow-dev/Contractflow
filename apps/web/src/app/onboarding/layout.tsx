import { RequireAuth } from "@/components/auth/require-auth";

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RequireAuth>{children}</RequireAuth>;
}