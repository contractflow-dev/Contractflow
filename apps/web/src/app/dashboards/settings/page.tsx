import { redirect } from "next/navigation";

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (key === "companyId" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item);
    }
  }
  const profilePath = "/dashboards/profile";
  const remainingQuery = params.toString();
  redirect(remainingQuery ? `${profilePath}?${remainingQuery}` : profilePath);
}
