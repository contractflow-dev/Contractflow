import { CompanyDashboardView } from "@/features/company-dashboard/_views/company-dashboard-view";

export default async function DashboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;

  return <CompanyDashboardView initialCompanyId={companyId ?? ""} />;
}
