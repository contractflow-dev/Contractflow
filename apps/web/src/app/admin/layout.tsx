import { RequirePlatformAdmin } from "@/components/auth/require-platform-admin";
import { AdminShell } from "@/features/admin/components/admin-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePlatformAdmin>
      <AdminShell>{children}</AdminShell>
    </RequirePlatformAdmin>
  );
}
