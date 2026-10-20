import { CompanyProfilePage } from "@/features/company-dashboard/company-profile-page";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  return <CompanyProfilePage initialCompanyId={companyId ?? ""} />;
}
