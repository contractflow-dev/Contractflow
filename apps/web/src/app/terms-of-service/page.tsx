import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { TermsOfServiceContent } from "@/components/legal/terms-of-service-content";

export const metadata = {
  title: "Terms of Service | ContractFlow",
  description: "Draft Terms of Service for ContractFlow, pending review.",
};

export default function TermsOfServicePage() {
  return (
    <LegalDocumentPage title="Terms of Service">
      <TermsOfServiceContent />
    </LegalDocumentPage>
  );
}
