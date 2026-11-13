import { RegisterForm } from "@/features/auth/components/register-form";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthTopBar } from "@/components/auth/authTopBar";

/** `invitationToken` comes from a company invitation's "Create an account". */
export function RegisterView({
  invitationToken,
}: {
  invitationToken?: string;
} = {}) {
  return (
    <main className="grid min-h-svh min-w-0 grid-cols-1 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col p-4 sm:p-6 lg:p-10">
        <AuthTopBar />

        {/* Content area: fills remaining height and centers the form */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full min-w-0 max-w-md space-y-6 py-4 sm:py-6">
            <RegisterForm invitationToken={invitationToken} />
          </div>
        </div>
      </section>

      <AuthHero />
    </main>
  );
}
