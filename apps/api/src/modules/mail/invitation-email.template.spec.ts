import { describe, expect, it } from 'vitest';
import { escapeHtml, renderInvitationEmail } from './invitation-email.template';

describe('escapeHtml', () => {
  it('escapes every character that can break out of text or an attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('renderInvitationEmail', () => {
  const content = {
    heading: 'Heading',
    intro: 'Intro',
    details: [{ label: 'Company', value: 'A & B' }],
    instructions: 'Review it.',
    ctaLabel: 'Review Invitation',
    url: 'https://app.example.com/invitations/respond?token=a&b=c',
    expiryNotice: 'Expires soon.',
  };

  it('escapes the link in the button and the fallback', () => {
    const { html } = renderInvitationEmail(content);

    expect(html).toContain(
      'href="https://app.example.com/invitations/respond?token=a&amp;b=c"',
    );
    expect(html).not.toContain('token=a&b=c');
    expect(html).toContain('A &amp; B');
  });

  it('keeps the raw link and details in the plain-text version', () => {
    const { text } = renderInvitationEmail(content);

    expect(text).toContain('Company: A & B');
    expect(text).toContain(
      'Review Invitation: https://app.example.com/invitations/respond?token=a&b=c',
    );
    expect(text).not.toContain('<');
  });
});
