import { CompanyTeamPage } from "@/features/company-dashboard/company-team-page";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  return <CompanyTeamPage initialCompanyId={companyId ?? ""} />;
}
