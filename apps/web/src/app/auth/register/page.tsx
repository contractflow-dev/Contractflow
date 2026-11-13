import { RegisterView } from "@/features/auth/_views/register-view";

export default async function RegisterRoute({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const { invitation } = await searchParams;
  return <RegisterView invitationToken={invitation || undefined} />;
}
