import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateContractForm, CreateContractWizard } from "./create-contract-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/services/contractApi", () => ({
  useGetContractsQuery: () => ({ currentData: undefined, isFetching: false }),
  useCreateContractMutation: () => [vi.fn(), { isLoading: false }],
}));

describe("CreateContractForm", () => {
  it("is offered only to company administrators", () => {
    expect(
      renderToStaticMarkup(
        <CreateContractForm companyId="company-1" canCreate={false} />,
      ),
    ).toBe("");

    const markup = renderToStaticMarkup(
      <CreateContractForm companyId="company-1" canCreate />,
    );
    expect(markup).toContain(">Contract setup</h2>");
    expect(markup).toMatch(/<button[^>]*aria-expanded="false"[^>]*>New contract</);
  });
});

describe("CreateContractWizard", () => {
  const wizard = () =>
    renderToStaticMarkup(
      <CreateContractWizard
        formId="new-contract"
        companyId="company-1"
        onCancel={() => undefined}
      />,
    );

  it("starts on the first of four steps", () => {
    const markup = wizard();

    expect(markup).toContain('aria-label="New draft contract"');
    expect(markup).toMatch(/<h3[^>]*tabindex="-1"[^>]*>Step 1 of 4: Basics<\/h3>/);
    const steps = [...markup.matchAll(/<li[^>]*>[\s\S]*?<\/li>/g)].map(
      (match) => match[0],
    );
    expect(steps).toHaveLength(4);
    expect(steps[0]).toContain('aria-current="step"');
    expect(steps.slice(1).join("")).not.toContain("aria-current");
    expect(markup).toContain(">Contract basics</legend>");
    // Later steps' fields aren't shown yet.
    expect(markup).not.toContain("Commercial terms</legend>");
  });

  it("moves on with Next and only creates on the last step", () => {
    const markup = wizard();

    // Next is the form's one submit button, so Enter in a field moves on.
    expect(markup).toMatch(
      /<button[^>]*type="submit"[^>]*>Next: Parties &amp; workspaces<\/button>/,
    );
    expect(markup.match(/type="submit"/g)).toHaveLength(1);
    expect(markup).not.toContain("Create draft contract");
    expect(markup).not.toContain(">Back<");
    expect(markup).toContain(">Cancel<");
  });
});
