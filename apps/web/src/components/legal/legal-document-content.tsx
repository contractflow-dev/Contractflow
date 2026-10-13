import { createElement, type ReactNode } from "react";

export interface LegalDocumentSection {
  title: string;
  paragraphs?: ReactNode[];
  bullets?: ReactNode[];
}

export function LegalDocumentContent({
  sections,
  headingLevel = "h2",
}: {
  sections: LegalDocumentSection[];
  headingLevel?: "h2" | "h3";
}) {
  return (
    <div className="min-w-0 space-y-7 break-words text-sm leading-7 text-foreground">
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          {createElement(
            headingLevel,
            { className: "text-base font-semibold tracking-tight" },
            section.title,
          )}
          {section.paragraphs?.map((paragraph, index) => (
            <p key={index} className="text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {section.bullets && (
            <ul className="list-disc space-y-1 ps-5 text-muted-foreground marker:text-primary">
              {section.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
