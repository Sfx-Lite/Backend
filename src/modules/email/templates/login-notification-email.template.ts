export interface LoginNotificationEmailTemplateInput {
  recipientName?: string | null;
  /** Human-readable time of the sign-in, e.g. "9 Aug 2026, 14:32 UTC". */
  loginTimeText: string;
  /** True when the sign-in happened on the admin dashboard. */
  isAdmin?: boolean;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  );

/**
 * Builds the "new sign-in" security notification sent after every successful
 * login, for both regular users and admins.
 */
export const buildLoginNotificationEmail = ({
  recipientName,
  loginTimeText,
  isAdmin,
}: LoginNotificationEmailTemplateInput): EmailTemplate => {
  const greetingName = recipientName?.trim() || 'there';
  const safeName = escapeHtml(greetingName);
  const safeTime = escapeHtml(loginTimeText);
  const surface = isAdmin ? 'the admin dashboard' : 'your account';

  return {
    subject: isAdmin
      ? 'New admin dashboard sign-in on your SFX Lite account'
      : 'New sign-in to your SFX Lite account',
    text: [
      `Hello ${greetingName},`,
      '',
      `We are letting you know about a new sign-in to ${surface}.`,
      `Time: ${loginTimeText}`,
      '',
      'If this was you, no action is needed.',
      'If you did not sign in, reset your password immediately and contact support.',
      '',
      'Regards,',
      'SFX Lite Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px;">
        <h2 style="color: #1d4ed8; margin-bottom: 16px;">New sign-in detected</h2>
        <p>Hello ${safeName},</p>
        <p>We are letting you know about a new sign-in to ${surface}.</p>
        <p style="margin: 20px 0; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #1d4ed8; border-radius: 4px;">
          <strong>Time:</strong> ${safeTime}
        </p>
        <p>If this was you, no action is needed.</p>
        <p style="color: #6b7280; font-size: 14px;">If you did not sign in, reset your password immediately and contact support.</p>
        <p style="margin-top: 24px;">Regards,<br />SFX Lite Team</p>
      </div>
    `.trim(),
  };
};
