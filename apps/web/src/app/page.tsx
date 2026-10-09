import type { UserProfile } from "@/services/authApi";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  let users: UserProfile[] = [];
  let error: string | null = null;
  try {
    users = await api<UserProfile[]>("/users");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to reach API";
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">contractflow</h1>
      {error ? (
        <p className="mt-4 text-red-600">API unreachable: {error}</p>
      ) : (
        <ul className="mt-4 space-y-1">
          {users.length === 0 && (
            <li className="text-gray-500">No users yet.</li>
          )}
          {users.map((u) => (
            <li key={u.id ?? u.email}>
              {u.firstName} {u.lastName}{" "}
              <span className="text-gray-500">({u.email})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
