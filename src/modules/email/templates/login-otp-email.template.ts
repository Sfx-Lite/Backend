export interface LoginOtpEmailTemplateInput {
  recipientName?: string | null;
  /** The one-time code the user must enter to complete the login. */
  otp: string;
  /** Human-readable lifetime of the code, e.g. "10 minutes". */
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
 * Builds the two-factor login email that delivers a single-use OTP. The code is
 * emailed to the account holder and entered on the app to finish signing in.
 */
export const buildLoginOtpEmail = ({
  recipientName,
  otp,
  expiresInText,
}: LoginOtpEmailTemplateInput): EmailTemplate => {
  const greetingName = recipientName?.trim() || 'there';
  const safeName = escapeHtml(greetingName);
  const safeOtp = escapeHtml(otp);

  return {
    subject: 'Your SFX Lite login verification code',
    text: [
      `Hello ${greetingName},`,
      '',
      'Use the verification code below to complete your sign-in:',
      '',
      otp,
      '',
      `This code expires in ${expiresInText} and can be used only once.`,
      'If you did not try to sign in, do not share this code and reset your password immediately.',
      '',
      'Regards,',
      'SFX Lite Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px;">
        <h2 style="color: #1d4ed8; margin-bottom: 16px;">Verify your login</h2>
        <p>Hello ${safeName},</p>
        <p>Use the verification code below to complete your sign-in to your SFX Lite account.</p>
        <p style="margin: 28px 0;">
          <span style="display: inline-block; background-color: #f1f5f9; color: #0f172a; font-size: 30px; letter-spacing: 8px; font-weight: bold; padding: 14px 24px; border-radius: 8px;">
            ${safeOtp}
          </span>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This code expires in ${escapeHtml(
          expiresInText,
        )} and can be used only once. If you did not try to sign in, do not share this code and reset your password immediately.</p>
        <p style="margin-top: 24px;">Regards,<br />SFX Lite Team</p>
      </div>
    `.trim(),
  };
};
