import { notFound } from "next/navigation";
import { CompanyDepartmentView } from "@/features/companies/_views/company-department-view";
import { parseDepartment } from "@/features/companies/departments";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: segment } = await params;
  const department = parseDepartment(segment);
  if (!department) notFound();
  return <CompanyDepartmentView department={department} />;
}
