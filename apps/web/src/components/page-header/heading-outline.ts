/**
 * Test helper: the <h1>–<h6> outline of rendered markup, and what is wrong
 * with it. A screen should have exactly one <h1>, first, and never skip a
 * level on the way down (an <h1> followed by an <h3>).
 */
export function headingOutline(
  markup: string,
): Array<{ level: number; text: string }> {
  return [...markup.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(
    ([, level, inner]) => ({
      level: Number(level),
      text: (inner ?? "").replace(/<[^>]+>/g, "").trim(),
    }),
  );
}

export function headingProblems(markup: string): string[] {
  const outline = headingOutline(markup);
  const problems: string[] = [];
  const h1Count = outline.filter(({ level }) => level === 1).length;
  if (h1Count !== 1) problems.push(`expected one <h1>, found ${h1Count}`);
  if (outline[0] && outline[0].level !== 1) {
    problems.push(
      `first heading is <h${outline[0].level}> "${outline[0].text}"`,
    );
  }
  outline.forEach((heading, index) => {
    const previous = outline[index - 1];
    if (previous && heading.level > previous.level + 1) {
      problems.push(
        `<h${previous.level}> "${previous.text}" is followed by <h${heading.level}> "${heading.text}"`,
      );
    }
  });
  return problems;
}
