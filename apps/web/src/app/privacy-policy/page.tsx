import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { PrivacyPolicyContent } from "@/components/legal/privacy-policy-content";

export const metadata = {
  title: "Privacy Policy | ContractFlow",
  description: "Draft Privacy Policy for ContractFlow, pending review.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage title="Privacy Policy">
      <PrivacyPolicyContent />
    </LegalDocumentPage>
  );
}
