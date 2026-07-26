import { Test } from '@nestjs/testing';

import {
  EMAIL_CONFIGURATION,
  RESEND_CLIENT,
} from './constants/email.constants';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const sendMock = jest.fn();

  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EMAIL_CONFIGURATION,
          useValue: {
            apiKey: 're_test_key',
            fromEmail: 'SFX Lite <notifications@example.com>',
          },
        },
        {
          provide: RESEND_CLIENT,
          useValue: {
            emails: {
              send: sendMock,
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get<EmailService>(EmailService);
  });

  it('sends an email and returns the provider ID', async () => {
    sendMock.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    await expect(
      service.send({
        to: 'user@example.com',
        subject: 'Test subject',
        text: 'Test message',
        html: '<p>Test message</p>',
      }),
    ).resolves.toBe('email-123');

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      from: 'SFX Lite <notifications@example.com>',
      to: ['user@example.com'],
      subject: 'Test subject',
      text: 'Test message',
      html: '<p>Test message</p>',
    });
  });

  it('throws when Resend returns an error', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Invalid recipient',
        name: 'validation_error',
      },
    });

    await expect(
      service.send({
        to: 'invalid@example.com',
        subject: 'Test',
        text: 'Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow('Resend email delivery failed: Invalid recipient');
  });

  it('throws when the provider call fails', async () => {
    sendMock.mockRejectedValue(new Error('Network failure'));

    await expect(
      service.send({
        to: 'user@example.com',
        subject: 'Test',
        text: 'Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow('Network failure');
  });

  it('throws when email configuration is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EMAIL_CONFIGURATION,
          useValue: {
            apiKey: undefined,
            fromEmail: undefined,
          },
        },
        {
          provide: RESEND_CLIENT,
          useValue: {
            emails: {
              send: sendMock,
            },
          },
        },
      ],
    }).compile();

    const unconfiguredService = moduleRef.get<EmailService>(EmailService);

    await expect(
      unconfiguredService.send({
        to: 'user@example.com',
        subject: 'Test',
        text: 'Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow('Email delivery is not configured');

    expect(sendMock).not.toHaveBeenCalled();
  });
});
