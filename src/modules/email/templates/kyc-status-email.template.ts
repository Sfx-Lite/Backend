import { KycSubmissionStatus } from '../../kyc/enums/kyc-submission-status.enum';

export interface KycStatusEmailTemplateInput {
  status: KycSubmissionStatus.APPROVED | KycSubmissionStatus.REJECTED;
  recipientName?: string | null;
  reason?: string | null;
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

export const buildKycStatusEmail = ({
  status,
  recipientName,
  reason,
}: KycStatusEmailTemplateInput): EmailTemplate => {
  const safeName = escapeHtml(recipientName?.trim() || 'there');
  const normalizedReason = reason?.trim();

  if (status === KycSubmissionStatus.APPROVED) {
    return {
      subject: 'Your KYC verification has been approved',
      text: [
        `Hello ${recipientName?.trim() || 'there'},`,
        '',
        'Your identity verification has been approved successfully.',
        'You can now access the features that require KYC verification.',
        '',
        'SFX Lite Team',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
          <h2 style="color: #15803d;">KYC verification approved</h2>
          <p>Hello ${safeName},</p>
          <p>Your identity verification has been approved successfully.</p>
          <p>You can now access the features that require KYC verification.</p>
          <p>Regards,<br />SFX Lite Team</p>
        </div>
      `.trim(),
    };
  }

  const textReason = normalizedReason || 'No additional reason was provided.';
  const safeReason = escapeHtml(textReason);

  return {
    subject: 'Update regarding your KYC verification',
    text: [
      `Hello ${recipientName?.trim() || 'there'},`,
      '',
      'Your identity verification was not approved.',
      `Reason: ${textReason}`,
      '',
      'Please review the information and submit a new verification request.',
      '',
      'SFX Lite Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="color: #b91c1c;">KYC verification not approved</h2>
        <p>Hello ${safeName},</p>
        <p>Your identity verification was not approved.</p>
        <p><strong>Reason:</strong> ${safeReason}</p>
        <p>Please review the information and submit a new verification request.</p>
        <p>Regards,<br />SFX Lite Team</p>
      </div>
    `.trim(),
  };
};
