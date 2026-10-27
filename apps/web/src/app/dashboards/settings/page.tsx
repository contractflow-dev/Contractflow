import { redirect } from "next/navigation";

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const profilePath = "/dashboards/profile";

  redirect(
    companyId
      ? `${profilePath}?companyId=${encodeURIComponent(companyId)}`
      : profilePath,
  );
}
