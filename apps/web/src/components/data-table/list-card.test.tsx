import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListCard } from "./list-card";

describe("ListCard", () => {
  it("puts the heading, description and action in the card header, and the list in its content", () => {
    const markup = renderToStaticMarkup(
      <ListCard
        id="members"
        headingId="members-heading"
        title="Members"
        description="3 memberships"
        action={<button type="button">Invite member</button>}
      >
        <p>THE LIST</p>
      </ListCard>,
    );

    expect(markup).toMatch(
      /^<section id="members" aria-labelledby="members-heading"/,
    );
    expect(markup).toContain('<h2 id="members-heading">Members</h2>');
    const header = markup.indexOf('data-slot="card-header"');
    const description = markup.indexOf("3 memberships");
    const action = markup.indexOf('data-slot="card-action"');
    const content = markup.indexOf('data-slot="card-content"');
    expect(header).toBeGreaterThan(0);
    expect(description).toBeGreaterThan(header);
    expect(action).toBeGreaterThan(description);
    expect(content).toBeGreaterThan(action);
    expect(markup.indexOf("THE LIST")).toBeGreaterThan(content);
    // The card keeps its own padding, so lists don't touch its edges.
    expect(markup).not.toContain("py-0");
  });

  it("names the section from a generated heading id, and leaves out what isn't given", () => {
    const markup = renderToStaticMarkup(
      <ListCard title="Contracts">
        <p>THE LIST</p>
      </ListCard>,
    );
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(markup).toContain(`<h2 id="${labelledBy}">Contracts</h2>`);
    expect(markup).not.toContain('data-slot="card-description"');
    expect(markup).not.toContain('data-slot="card-action"');
  });
});
