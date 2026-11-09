import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { headingOutline, headingProblems } from "./heading-outline";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title as the page's <h1> with the shared title style", () => {
    const markup = renderToStaticMarkup(
      <PageHeader
        eyebrow="Company administration"
        title="Company profile"
        description="Update the registered company and contact details."
      />,
    );

    expect(headingOutline(markup)).toEqual([
      { level: 1, text: "Company profile" },
    ]);
    expect(markup).toMatch(/<h1 class="[^"]*type-page-title/);
    expect(markup).toContain(
      '<p class="type-eyebrow">Company administration</p>',
    );
    expect(markup).toContain(
      "Update the registered company and contact details.",
    );
  });

  it("omits the eyebrow and description when they aren't given", () => {
    const markup = renderToStaticMarkup(<PageHeader title="Contracts" />);

    expect(markup).not.toContain("type-eyebrow");
    expect(markup).not.toContain("type-lead");
  });
});

describe("headingProblems", () => {
  it("accepts one <h1> followed by nested sections", () => {
    expect(headingProblems("<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>")).toEqual(
      [],
    );
  });

  it("reports a missing or repeated <h1>, a late <h1>, and skipped levels", () => {
    expect(headingProblems("<h2>A</h2>")).toEqual([
      "expected one <h1>, found 0",
      'first heading is <h2> "A"',
    ]);
    expect(headingProblems("<h1>A</h1><h1>B</h1>")).toEqual([
      "expected one <h1>, found 2",
    ]);
    expect(headingProblems("<h1>A</h1><h3>B</h3>")).toEqual([
      '<h1> "A" is followed by <h3> "B"',
    ]);
  });
});
