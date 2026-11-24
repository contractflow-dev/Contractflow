import { RequireAuth } from "@/components/auth/require-auth";

export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RequireAuth>{children}</RequireAuth>;
}
