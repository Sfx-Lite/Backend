export interface PasswordResetEmailTemplateInput {
  recipientName?: string | null;
  resetUrl: string;
  /** Human-readable lifetime of the link, e.g. "60 minutes". */
  expiresInText: string;
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
 * Builds a professional, plain (no emoji) password-reset email. The link points
 * at the web client's reset page and carries the single-use token in the path.
 */
export const buildPasswordResetEmail = ({
  recipientName,
  resetUrl,
  expiresInText,
}: PasswordResetEmailTemplateInput): EmailTemplate => {
  const greetingName = recipientName?.trim() || 'there';
  const safeName = escapeHtml(greetingName);
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: 'Reset your SFX Lite password',
    text: [
      `Hello ${greetingName},`,
      '',
      'We received a request to reset the password for your SFX Lite account.',
      'Use the link below to set a new password:',
      '',
      resetUrl,
      '',
      `For your security, this link expires in ${expiresInText} and can be used only once.`,
      'If you did not request a password reset, you can safely ignore this email; your password will remain unchanged.',
      '',
      'Regards,',
      'SFX Lite Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px;">
        <h2 style="color: #1d4ed8; margin-bottom: 16px;">Reset your password</h2>
        <p>Hello ${safeName},</p>
        <p>We received a request to reset the password for your SFX Lite account. Click the button below to set a new password.</p>
        <p style="margin: 28px 0;">
          <a href="${safeUrl}"
             style="background-color: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold;">
            Reset password
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all;"><a href="${safeUrl}" style="color: #1d4ed8;">${safeUrl}</a></p>
        <p style="color: #6b7280; font-size: 14px;">For your security, this link expires in ${escapeHtml(
          expiresInText,
        )} and can be used only once. If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.</p>
        <p style="margin-top: 24px;">Regards,<br />SFX Lite Team</p>
      </div>
    `.trim(),
  };
};
