import { Module } from '@nestjs/common';
import { Resend } from 'resend';

import { env } from '../../config/env';
import {
  EMAIL_CONFIGURATION,
  EmailConfiguration,
  RESEND_CLIENT,
} from './constants/email.constants';
import { EmailService } from './email.service';

@Module({
  providers: [
    {
      provide: EMAIL_CONFIGURATION,
      useFactory: (): EmailConfiguration => ({
        apiKey: env.email.resendApiKey,
        fromEmail: env.email.fromEmail,
      }),
    },
    {
      provide: RESEND_CLIENT,
      inject: [EMAIL_CONFIGURATION],
      useFactory: (configuration: EmailConfiguration): Resend =>
        new Resend(configuration.apiKey?.trim() || 'missing-api-key'),
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
