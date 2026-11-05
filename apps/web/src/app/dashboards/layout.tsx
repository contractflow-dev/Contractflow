import { RequireAuth } from "@/components/auth/require-auth";

export default function DashboardsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RequireAuth>{children}</RequireAuth>;
}