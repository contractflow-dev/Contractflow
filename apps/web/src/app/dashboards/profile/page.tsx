import { CompanyProfileView } from "@/features/company-dashboard/_views/company-profile-view";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  return <CompanyProfileView initialCompanyId={companyId ?? ""} />;
}
