import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { KYC_SUBMISSION_RECEIVED_EVENT } from '../../kyc/events/kyc-submission-received.event';
import { NotificationsService } from '../notifications.service';

import type { KycSubmissionReceivedEvent } from '../../kyc/events/kyc-submission-received.event';

@Injectable()
export class KycSubmissionReceivedListener {
  private readonly logger = new Logger(KycSubmissionReceivedListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(KYC_SUBMISSION_RECEIVED_EVENT, { async: true })
  async handle(event: KycSubmissionReceivedEvent): Promise<void> {
    try {
      await this.notificationsService.createForAdmins({
        type: 'kyc_submission_received',
        title: 'New KYC submission received',
        body: `A new KYC submission requires review. Submission ID: ${event.submissionId}`,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown notification error';

      this.logger.error(
        `Failed to notify admins about KYC submission ${event.submissionId}: ${message}`,
      );
    }
  }
}
