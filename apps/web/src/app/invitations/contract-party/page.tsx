import { ContractPartyInvitationResponse } from "@/features/contracts/components/contract-party-invitation-response";

export default async function ContractPartyInvitationRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ContractPartyInvitationResponse token={token ?? ""} />;
}
