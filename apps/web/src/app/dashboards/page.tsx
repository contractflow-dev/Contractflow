import { CompanyDashboardPage } from "@/features/company-dashboard/company-dashboard-page";

export default async function DashboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;

  return <CompanyDashboardPage initialCompanyId={companyId ?? ""} />;
}
