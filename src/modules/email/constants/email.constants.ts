export const RESEND_CLIENT = Symbol('RESEND_CLIENT');
export const EMAIL_CONFIGURATION = Symbol('EMAIL_CONFIGURATION');

export interface EmailConfiguration {
  apiKey?: string;
  fromEmail?: string;
}
