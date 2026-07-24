import { Inject, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

import {
  EMAIL_CONFIGURATION,
  RESEND_CLIENT,
} from './constants/email.constants';

import type { EmailConfiguration } from './constants/email.constants';
import { SendEmailOptions } from './interfaces/send-email-options.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(RESEND_CLIENT)
    private readonly resend: Resend,
    @Inject(EMAIL_CONFIGURATION)
    private readonly configuration: EmailConfiguration,
  ) {}

  async send(options: SendEmailOptions): Promise<string> {
    const apiKey = this.configuration.apiKey?.trim();
    const fromEmail = this.configuration.fromEmail?.trim();

    if (!apiKey || !fromEmail) {
      throw new Error(
        'Email delivery is not configured. RESEND_API_KEY and RESEND_FROM_EMAIL are required.',
      );
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: fromEmail,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        throw new Error(`Resend email delivery failed: ${error.message}`);
      }

      if (!data?.id) {
        throw new Error('Resend returned an invalid email delivery response.');
      }

      this.logger.log(
        `Email queued successfully for ${options.to}; provider ID: ${data.id}`,
      );

      return data.id;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown email provider error';

      this.logger.error(`Failed to send email to ${options.to}: ${message}`);

      throw error instanceof Error ? error : new Error(message);
    }
  }
}
