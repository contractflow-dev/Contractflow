import { VerificationPendingView } from "@/features/auth/_views/verification-pending-view";

export default async function VerificationPendingRoute({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>;
}) {
  const { invited } = await searchParams;
  return <VerificationPendingView invited={invited === "1"} />;
}
