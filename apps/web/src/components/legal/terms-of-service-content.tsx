import {
  LegalDocumentContent,
  type LegalDocumentSection,
} from "./legal-document-content";

const sections: LegalDocumentSection[] = [
  {
    title: "Introduction",
    paragraphs: [
      "These Terms of Service describe the proposed terms for using ContractFlow, a contract lifecycle and company administration application. This draft is based on the functionality present in the application and must be reviewed and completed by the service owner and qualified legal counsel before publication.",
    ],
  },
  {
    title: "Acceptance of these terms",
    paragraphs: [
      "The web registration form asks you to affirm that you agree to these Terms and acknowledge the Privacy Policy before it submits an account request. The current API does not store a durable record of that selection; the service owner must determine and implement any required consent-record process before relying on the acceptance for legal or audit purposes. Do not use the service if you do not agree.",
    ],
  },
  {
    title: "Accounts and responsibilities",
    paragraphs: [
      "Provide accurate registration information, keep your sign-in credentials confidential, and use only accounts you are authorized to access. You are responsible for activity performed through your account, subject to any rights that cannot be excluded by applicable law.",
      "The account recovery, organization administrator, and account deletion processes and contact channel have not been specified. The service owner must complete these details before publication: [INSERT ACCOUNT SUPPORT AND DELETION PROCESS].",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Use the service only for lawful purposes and only with the rights and permissions needed to submit the information you provide. Do not attempt to bypass access controls, interfere with the service, or use it to violate another person's rights. The service owner should review and approve a complete acceptable-use policy before publication.",
    ],
  },
  {
    title: "Your content and intellectual property",
    paragraphs: [
      "The application supports company, membership, invitation, and contract records. You and your organization are responsible for the content submitted and for having authority to submit it.",
      "Ownership of the ContractFlow service, the precise rights granted to operate on customer content, and any permitted use of feedback must be confirmed by the service owner: [INSERT APPROVED INTELLECTUAL-PROPERTY AND CONTENT-LICENCE TERMS]. Do not rely on this draft to define those rights.",
    ],
  },
  {
    title: "Service availability and limitations",
    paragraphs: [
      "No service-level commitment, support hours, backup commitment, or availability guarantee is currently specified in the project materials. Those commitments, if any, must be completed here before publication: [INSERT APPROVED SERVICE AND SUPPORT COMMITMENTS].",
    ],
  },
  {
    title: "Suspension and termination",
    paragraphs: [
      "The circumstances and process for suspending or closing accounts, handling customer data after closure, and any notice or appeal rights are not specified. The service owner must supply and approve these terms: [INSERT ACCOUNT SUSPENSION, TERMINATION, AND DATA-EXPORT TERMS].",
    ],
  },
  {
    title: "Disclaimers and liability",
    paragraphs: [
      "The applicable warranty disclaimers, liability limits, exclusions, and any mandatory consumer or business protections depend on the service owner's operating model and governing law. No such limits are asserted by this draft. Obtain jurisdiction-specific legal review and insert approved language before publication: [INSERT REVIEWED DISCLAIMER AND LIABILITY TERMS].",
    ],
  },
  {
    title: "Changes to these terms",
    paragraphs: [
      "A process for updating these Terms, notifying users, and obtaining any renewed acceptance that may be required has not been defined. The service owner must set and publish that process before relying on these Terms: [INSERT CHANGE-NOTICE AND RE-ACCEPTANCE PROCESS].",
    ],
  },
  {
    title: "Governing law and contact",
    paragraphs: [
      "The contracting service provider, governing law, venue, and official contact details have not been identified in the project. Complete these fields after legal review: [INSERT LEGAL ENTITY NAME], [INSERT GOVERNING LAW AND VENUE], and [INSERT TERMS SUPPORT EMAIL OR CONTACT METHOD].",
    ],
  },
  {
    title: "Effective date",
    paragraphs: [
      "Effective date: [TO BE SET BEFORE PUBLICATION]. Last updated: [TO BE SET BEFORE PUBLICATION].",
    ],
  },
];

export function TermsOfServiceContent({
  headingLevel,
}: {
  headingLevel?: "h2" | "h3";
}) {
  return (
    <LegalDocumentContent sections={sections} headingLevel={headingLevel} />
  );
}
