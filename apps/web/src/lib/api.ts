import { getApiBaseUrl } from './apiBaseUrl';

const API_URL = getApiBaseUrl();

/**
 * Generic lightweight fetch wrapper for server-side requests in Server Components.
 * For client components, prefer RTK Query hooks from `@/services`.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}
