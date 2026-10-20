import { CompanyInvitationResponsePage } from "@/features/company-dashboard/company-invitation-response-page";

export default async function InvitationResponseRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <CompanyInvitationResponsePage token={token ?? ""} />;
}
