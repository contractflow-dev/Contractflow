import {
  LegalDocumentContent,
  type LegalDocumentSection,
} from "./legal-document-content";

const sections: LegalDocumentSection[] = [
  {
    title: "Introduction and scope",
    paragraphs: [
      "This draft Privacy Policy describes information the ContractFlow application is currently designed to handle. It must be reviewed by the service owner and qualified privacy counsel, completed with business-specific details, and checked against actual production configuration before publication. It is not a compliance certification or legal advice.",
    ],
  },
  {
    title: "Information the application handles",
    paragraphs: [
      "Based on the current data models and registration flow, information may include:",
    ],
    bullets: [
      "Account details: email address, first, middle, and last names, optional phone number, time zone, account status, and email-verification and sign-in timestamps.",
      "Authentication data: a scrypt password hash (not the plain-text password), hashed session and email-verification tokens, session expiry and revocation details, and—when signing in—the request IP address and user-agent string.",
      "Organization data: organization legal and display names, registration and tax identifiers, organization email, phone, website and address, currency, membership role and status, and invitation recipient details.",
      "Contract records: reference, title, description, type and status, financial amounts and terms, currency, dates, and other contract lifecycle fields entered by authorized users.",
      "Preference data: the selected light or dark theme is stored in this browser's local storage under the key `contractflow-theme`; it is not required to create an account.",
    ],
  },
  {
    title: "How information is collected",
    paragraphs: [
      "Information is supplied by people who register, sign in, verify an email address, create or manage an organization, invite members, or enter contract information. The API also receives request metadata such as IP address and user-agent during sign-in. The web app stores the display-theme preference locally in the browser.",
    ],
  },
  {
    title: "Purposes of processing",
    paragraphs: [
      "The implemented application uses account and organization information to create accounts, verify email addresses, authenticate users, enforce account and organization access, and provide organization and contract-management functionality. Contact information is used to deliver account-verification email. Session and request metadata support sign-in and session management. Theme preference is used to restore the selected appearance.",
      "Any additional purposes, lawful bases, or jurisdiction-specific disclosures must be determined by the service owner and added here: [INSERT APPROVED PROCESSING PURPOSES AND LEGAL BASES, WHERE REQUIRED].",
    ],
  },
  {
    title: "Policy acknowledgement",
    paragraphs: [
      "The registration form currently validates the Terms of Service checkbox in the browser, but does not send that value to or store it in the API. Accordingly, the current service does not retain a record of a person's acceptance through that checkbox. The service owner should implement and document a durable consent record if one is required for the service or applicable law.",
    ],
  },
  {
    title: "Storage, security, and retention",
    paragraphs: [
      "The repository configures a PostgreSQL database for deployment. Passwords are hashed with scrypt; session and email-verification tokens are stored as hashes. The authentication cookie is HTTP-only and SameSite=Lax, and is configured as Secure in production. Session lifetime is configurable and defaults to seven days; email-verification tokens expire after 30 minutes.",
      "These implementation details do not guarantee that every deployment is secure. Hosting location, encryption and backup practices, access controls, incident procedures, and retention/deletion periods for accounts, organization and contract records, sessions, logs, and backups must be confirmed for the actual production service: [INSERT APPROVED SECURITY, HOSTING, AND RETENTION DETAILS].",
    ],
  },
  {
    title: "Cookies and local storage",
    paragraphs: [
      "The API uses the essential `contractflow_session` HTTP-only cookie to authenticate a signed-in user. Its configured lifetime defaults to seven days and may be changed by the service configuration. The web application also uses browser local storage for the theme preference described above. The repository contains no analytics or advertising-cookie integration; production deployment should be checked for any additional scripts or services before publication.",
    ],
  },
  {
    title: "Service providers and sharing",
    paragraphs: [
      "Verification email delivery is configured to use SMTP or Resend, depending on deployment settings. In production, the repository's deployment configuration provisions a Render PostgreSQL database and deploys the web and API services on Render. These providers may process information necessary to host the service or deliver email. The actual provider configuration, data locations, contracts, subprocessors, and any other recipients must be confirmed and listed by the service owner: [INSERT CURRENT PROVIDER/SUBPROCESSOR LIST AND DETAILS].",
      "The code reviewed for this draft does not show analytics or advertising integrations. This statement should be re-checked against the actual production environment.",
    ],
  },
  {
    title: "Your privacy rights and requests",
    paragraphs: [
      "The rights available to a person depend on their location and the service provider's role. The application does not currently expose a self-service privacy-request or account-deletion workflow in the reviewed code. The service owner must specify how users can request access, correction, export, deletion, or exercise other applicable rights, and how identity will be verified: [INSERT PRIVACY CONTACT AND REQUEST PROCESS].",
    ],
  },
  {
    title: "International transfers",
    paragraphs: [
      "The production data-region and email-delivery regions are not specified in the repository. The service owner must confirm where information is stored or accessed and describe applicable transfer safeguards: [INSERT CONFIRMED DATA LOCATIONS AND TRANSFER DETAILS].",
    ],
  },
  {
    title: "Children's privacy",
    paragraphs: [
      "The intended minimum user age and any controls relating to children's information have not been specified. The service owner must determine and state the applicable age requirements and response process: [INSERT APPROVED CHILDREN'S PRIVACY TERMS].",
    ],
  },
  {
    title: "Policy updates",
    paragraphs: [
      "The process and timing for notifying users about privacy-policy changes has not been specified. The service owner must define it and update the last-updated date when publishing changes: [INSERT POLICY-CHANGE NOTICE PROCESS].",
    ],
  },
  {
    title: "Contact and dates",
    paragraphs: [
      "Privacy contact: [INSERT LEGAL ENTITY NAME AND PRIVACY CONTACT EMAIL OR REQUEST METHOD]. Effective date: [TO BE SET BEFORE PUBLICATION]. Last updated: [TO BE SET BEFORE PUBLICATION].",
    ],
  },
];

export function PrivacyPolicyContent({
  headingLevel,
}: {
  headingLevel?: "h2" | "h3";
}) {
  return (
    <LegalDocumentContent sections={sections} headingLevel={headingLevel} />
  );
}
