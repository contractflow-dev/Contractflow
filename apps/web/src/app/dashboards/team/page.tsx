import { CompanyTeamView } from "@/features/companies/_views/company-team-view";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  return <CompanyTeamView initialCompanyId={companyId ?? ""} />;
}
