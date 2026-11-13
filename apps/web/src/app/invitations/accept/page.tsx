import { redirect } from "next/navigation";

/**
 * The earlier address for company invitation links. Links now open
 * /invitations/respond, which this forwards to with the same token.
 */
export default async function AcceptInvitationRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect(
    token
      ? `/invitations/respond?token=${encodeURIComponent(token)}`
      : "/invitations",
  );
}
