import { InvitationResponseView } from "@/features/companies/_views/invitation-response-view";

export default async function InvitationResponseRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <InvitationResponseView token={token ?? ""} />;
}
