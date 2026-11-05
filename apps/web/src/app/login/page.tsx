import { Suspense } from "react";
import { LoginView } from "@/features/auth/_views/login-view";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-svh place-items-center p-6">
          <p role="status" className="text-sm text-muted-foreground">
            Loading sign in…
          </p>
        </main>
      }
    >
      <LoginView />
    </Suspense>
  );
}
