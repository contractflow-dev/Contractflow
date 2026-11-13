/**
 * Builds the HTML and plain-text bodies of ContractFlow invitation emails.
 *
 * The call-to-action only opens the invitation's review page. Accepting is a
 * separate, explicit step on that page, and the API validates the token,
 * expiry, single use and invited email when the recipient responds.
 */

export interface InvitationEmailDetail {
  label: string;
  value: string;
}

export interface InvitationEmailContent {
  /** Short heading, e.g. "You're invited to join Example Energy". */
  heading: string;
  /** Opening line of the plain-text version, e.g. "Hello,". */
  greeting?: string;
  /** Why the recipient is receiving this email. */
  intro: string;
  details: readonly InvitationEmailDetail[];
  /** What the recipient does on the review page. */
  instructions: string;
  ctaLabel: string;
  /** The review page link, including its single-use token. */
  url: string;
  expiryNotice: string;
}

export interface RenderedEmail {
  text: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes a value for use in HTML text or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

const SECURITY_NOTICE =
  "If you weren't expecting this invitation, you can ignore this email. " +
  'Nothing changes unless you sign in and accept it.';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const BRAND_COLOR = '#b8491a';
const TEXT_COLOR = '#1f2328';
const MUTED_COLOR = '#59636e';
const BORDER_COLOR = '#e4e7eb';

export function renderInvitationEmail(
  content: InvitationEmailContent,
): RenderedEmail {
  return { text: renderText(content), html: renderHtml(content) };
}

function renderText(content: InvitationEmailContent): string {
  const lines = [
    ...(content.greeting ? [content.greeting, ''] : []),
    content.intro,
    '',
    ...content.details.map((detail) => `${detail.label}: ${detail.value}`),
    '',
    content.instructions,
    '',
    `${content.ctaLabel}: ${content.url}`,
    '',
    content.expiryNotice,
    '',
    SECURITY_NOTICE,
    '',
    '— ContractFlow',
  ];
  return lines.join('\n');
}

function renderHtml(content: InvitationEmailContent): string {
  const url = escapeHtml(content.url);
  const detailRows = content.details
    .map(
      (detail) => `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid ${BORDER_COLOR};font-size:14px;line-height:20px;color:${MUTED_COLOR};width:40%;vertical-align:top;">${escapeHtml(detail.label)}</td>
                  <td style="padding:8px 0 8px 12px;border-bottom:1px solid ${BORDER_COLOR};font-size:14px;line-height:20px;color:${TEXT_COLOR};font-weight:600;vertical-align:top;">${escapeHtml(detail.value)}</td>
                </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(content.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:${FONT_STACK};color:${TEXT_COLOR};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.intro)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid ${BORDER_COLOR};border-radius:8px;">
            <tr>
              <td style="padding:20px 32px;border-bottom:3px solid ${BRAND_COLOR};font-family:${FONT_STACK};font-size:20px;line-height:28px;font-weight:700;color:${BRAND_COLOR};">ContractFlow</td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;font-family:${FONT_STACK};">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:700;color:${TEXT_COLOR};">${escapeHtml(content.heading)}</h1>
                <p style="margin:0 0 20px;font-size:16px;line-height:24px;color:${TEXT_COLOR};">${escapeHtml(content.intro)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid ${BORDER_COLOR};font-family:${FONT_STACK};">${detailRows}
                </table>
                <p style="margin:0 0 20px;font-size:15px;line-height:22px;color:${TEXT_COLOR};">${escapeHtml(content.instructions)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" bgcolor="${BRAND_COLOR}" style="border-radius:6px;background-color:${BRAND_COLOR};">
                      <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(content.ctaLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:14px;line-height:20px;color:${MUTED_COLOR};">${escapeHtml(content.expiryNotice)}</p>
                <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${MUTED_COLOR};">If the button doesn't work, copy this link into your browser:</p>
                <p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;"><a href="${url}" target="_blank" rel="noopener" style="color:${BRAND_COLOR};text-decoration:underline;">${url}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid ${BORDER_COLOR};border-radius:0 0 8px 8px;font-family:${FONT_STACK};font-size:13px;line-height:20px;color:${MUTED_COLOR};">
                <p style="margin:0 0 8px;">${escapeHtml(SECURITY_NOTICE)}</p>
                <p style="margin:0;">This email was sent by ContractFlow.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
