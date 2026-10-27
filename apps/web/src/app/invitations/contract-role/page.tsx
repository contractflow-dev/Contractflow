import { ContractRoleInvitationResponse } from "@/features/contracts/components/contract-role-invitation-response";

export default async function ContractRoleInvitationRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ContractRoleInvitationResponse token={token ?? ""} />;
}
