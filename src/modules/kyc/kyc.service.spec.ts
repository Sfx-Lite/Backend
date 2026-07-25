import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { EmailService } from '../email/email.service';
import { User } from '../users/entities/user.entity';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { KycService } from './kyc.service';

describe('KycService', () => {
  let service: KycService;

  let submissionRepository: jest.Mocked<
    Pick<Repository<KycSubmission>, 'findOne' | 'save'>
  >;

  let userRepository: jest.Mocked<Pick<Repository<User>, 'findOne'>>;

  let emailService: jest.Mocked<Pick<EmailService, 'send'>>;

  beforeEach(async () => {
    submissionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
    };

    emailService = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: getRepositoryToken(KycSubmission),
          useValue: submissionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  it('throws when the KYC submission does not exist', async () => {
    submissionRepository.findOne.mockResolvedValue(null);

    await expect(
      service.reviewSubmission(
        'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
        '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        {
          status: KycSubmissionStatus.APPROVED,
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(submissionRepository.save).not.toHaveBeenCalled();
    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('approves an under-review submission and sends an email', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      userId: 'user-1',
      status: KycSubmissionStatus.UNDER_REVIEW,
      reason: 'Old reason',
      reviewedBy: null,
      reviewedAt: null,
    } as KycSubmission;

    const user = {
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
    } as User;

    submissionRepository.findOne.mockResolvedValue(submission);
    submissionRepository.save.mockImplementation((value: KycSubmission) =>
      Promise.resolve(value),
    );
    userRepository.findOne.mockResolvedValue(user);
    emailService.send.mockResolvedValue('email-123');

    await service.reviewSubmission(
      submission.id,
      '67638e0d-6835-4d54-875a-f6bdb3910ee6',
      {
        status: KycSubmissionStatus.APPROVED,
      },
    );

    expect(submissionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: KycSubmissionStatus.APPROVED,
        reviewedBy: '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        reason: null,
      }),
    );

    expect(submission.reviewedAt).toBeInstanceOf(Date);

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Your KYC verification has been approved',
      }),
    );
  });

  it('rejects an under-review submission and sends the rejection reason', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      userId: 'user-1',
      status: KycSubmissionStatus.UNDER_REVIEW,
      reason: null,
      reviewedBy: null,
      reviewedAt: null,
    } as KycSubmission;

    const user = {
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
    } as User;

    submissionRepository.findOne.mockResolvedValue(submission);
    submissionRepository.save.mockImplementation((value: KycSubmission) =>
      Promise.resolve(value),
    );
    userRepository.findOne.mockResolvedValue(user);
    emailService.send.mockResolvedValue('email-123');

    await service.reviewSubmission(
      submission.id,
      '67638e0d-6835-4d54-875a-f6bdb3910ee6',
      {
        status: KycSubmissionStatus.REJECTED,
        reason: 'Document image is unreadable',
      },
    );

    expect(submissionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: KycSubmissionStatus.REJECTED,
        reviewedBy: '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        reason: 'Document image is unreadable',
      }),
    );

    expect(submission.reviewedAt).toBeInstanceOf(Date);

    expect(emailService.send).toHaveBeenCalledTimes(1);

    const sentEmail = emailService.send.mock.calls[0]?.[0];

    expect(sentEmail).toBeDefined();

    if (!sentEmail) {
      throw new Error('Expected email payload to exist');
    }

    expect(sentEmail.to).toBe('user@example.com');
    expect(sentEmail.subject).toBe('Update regarding your KYC verification');
    expect(sentEmail.text).toContain('Document image is unreadable');
    expect(sentEmail.html).toContain('Document image is unreadable');
  });

  it('rejects an invalid status transition', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      userId: 'user-1',
      status: KycSubmissionStatus.PENDING,
    } as KycSubmission;

    submissionRepository.findOne.mockResolvedValue(submission);

    await expect(
      service.reviewSubmission(
        submission.id,
        '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        {
          status: KycSubmissionStatus.APPROVED,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(submissionRepository.save).not.toHaveBeenCalled();
    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('rejects a reason when approving a submission', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      userId: 'user-1',
      status: KycSubmissionStatus.UNDER_REVIEW,
    } as KycSubmission;

    submissionRepository.findOne.mockResolvedValue(submission);

    await expect(
      service.reviewSubmission(
        submission.id,
        '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        {
          status: KycSubmissionStatus.APPROVED,
          reason: 'This should not be provided',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(submissionRepository.save).not.toHaveBeenCalled();
    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('keeps the KYC update successful when email delivery fails', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      userId: 'user-1',
      status: KycSubmissionStatus.UNDER_REVIEW,
      reason: null,
      reviewedBy: null,
      reviewedAt: null,
    } as KycSubmission;

    const user = {
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
    } as User;

    submissionRepository.findOne.mockResolvedValue(submission);
    submissionRepository.save.mockImplementation((value: KycSubmission) =>
      Promise.resolve(value),
    );
    userRepository.findOne.mockResolvedValue(user);
    emailService.send.mockRejectedValue(new Error('Provider unavailable'));

    await expect(
      service.reviewSubmission(
        submission.id,
        '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        {
          status: KycSubmissionStatus.APPROVED,
        },
      ),
    ).resolves.toBeDefined();

    expect(submissionRepository.save).toHaveBeenCalled();
    expect(emailService.send).toHaveBeenCalled();
  });

  it('keeps the KYC update successful when the user cannot be found', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      userId: 'missing-user',
      status: KycSubmissionStatus.UNDER_REVIEW,
      reason: null,
      reviewedBy: null,
      reviewedAt: null,
    } as KycSubmission;

    submissionRepository.findOne.mockResolvedValue(submission);
    submissionRepository.save.mockImplementation((value: KycSubmission) =>
      Promise.resolve(value),
    );
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.reviewSubmission(
        submission.id,
        '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        {
          status: KycSubmissionStatus.APPROVED,
        },
      ),
    ).resolves.toBeDefined();

    expect(submissionRepository.save).toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
