import { RequireAuth } from "@/components/auth/require-auth";
import { MyInvitationsView } from "@/features/invitations/_views/my-invitations-view";

export default function MyInvitationsRoute() {
  return (
    <RequireAuth>
      <MyInvitationsView />
    </RequireAuth>
  );
}
