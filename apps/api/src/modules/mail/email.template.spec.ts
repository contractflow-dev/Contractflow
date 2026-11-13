import { describe, expect, it } from 'vitest';
import { escapeHtml, renderEmail } from './email.template';

describe('escapeHtml', () => {
  it('escapes every character that can break out of text or an attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('renderEmail', () => {
  const content = {
    heading: 'Heading',
    intro: 'Intro',
    details: [{ label: 'Company', value: 'A & B' }],
    instructions: 'Review it.',
    ctaLabel: 'Review Invitation',
    url: 'https://app.example.com/invitations/respond?token=a&b=c',
    expiryNotice: 'Expires soon.',
    securityNotice: 'Ignore <this> if unexpected.',
  };

  it('escapes the link in the button and the fallback', () => {
    const { html } = renderEmail(content);

    expect(html).toContain(
      'href="https://app.example.com/invitations/respond?token=a&amp;b=c"',
    );
    expect(html).not.toContain('token=a&b=c');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('Ignore &lt;this&gt; if unexpected.');
  });

  it('keeps the raw link, details and notices in the plain-text version', () => {
    const { text } = renderEmail(content);

    expect(text).toContain('Company: A & B');
    expect(text).toContain(
      'Review Invitation: https://app.example.com/invitations/respond?token=a&b=c',
    );
    expect(text).toContain('Expires soon.');
    expect(text).toContain('Ignore <this> if unexpected.');
  });

  it('leaves out the details table and instructions when there are none', () => {
    const { text, html } = renderEmail({
      heading: 'Verify your email address',
      intro: 'Confirm your email address.',
      ctaLabel: 'Verify Email Address',
      url: 'https://app.example.com/auth/verify-email?token=t',
      expiryNotice: 'Expires soon.',
      securityNotice: 'Ignore if unexpected.',
    });

    expect(html).not.toContain('border-top:1px solid #e4e7eb;font-family');
    expect(text).toBe(
      [
        'Confirm your email address.',
        '',
        'Verify Email Address: https://app.example.com/auth/verify-email?token=t',
        '',
        'Expires soon.',
        '',
        'Ignore if unexpected.',
        '',
        '— ContractFlow',
      ].join('\n'),
    );
  });
});
