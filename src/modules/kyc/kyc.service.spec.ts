import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadsService } from '../uploads/uploads.service';
import { User } from '../users/entities/user.entity';
import { KycStatus } from '../users/enums/kyc-status.enum';
import { KycDocType } from './enums/kyc-doc-type.enum';
import { KycSubmission } from './entities/kyc-submission.entity';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { KycService } from './kyc.service';

describe('KycService', () => {
  let service: KycService;

  let submissionRepository: jest.Mocked<
    Pick<Repository<KycSubmission>, 'findOne' | 'save' | 'create'>
  >;

  let userRepository: jest.Mocked<Pick<Repository<User>, 'findOne' | 'update'>>;

  let emailService: jest.Mocked<Pick<EmailService, 'send'>>;

  let uploadsService: jest.Mocked<Pick<UploadsService, 'uploadImage'>>;

  let notificationsService: jest.Mocked<Pick<NotificationsService, 'create'>>;

  let auditService: jest.Mocked<Pick<AuditService, 'saveLog'>>;

  beforeEach(async () => {
    submissionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };
    userRepository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });

    emailService = {
      send: jest.fn(),
    };

    uploadsService = {
      uploadImage: jest.fn(),
    };

    notificationsService = {
      create: jest.fn(),
    };
    notificationsService.create.mockResolvedValue({} as never);

    auditService = {
      saveLog: jest.fn(),
    };
    auditService.saveLog.mockResolvedValue(null);

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
        {
          provide: UploadsService,
          useValue: uploadsService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: AuditService,
          useValue: auditService,
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
    submissionRepository.save.mockImplementation((value) =>
      Promise.resolve(value as KycSubmission),
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

    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      kycStatus: KycStatus.VERIFIED,
    });

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

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'kyc',
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
    submissionRepository.save.mockImplementation((value) =>
      Promise.resolve(value as KycSubmission),
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

    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      kycStatus: KycStatus.REJECTED,
    });

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
    submissionRepository.save.mockImplementation((value) =>
      Promise.resolve(value as KycSubmission),
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
    submissionRepository.save.mockImplementation((value) =>
      Promise.resolve(value as KycSubmission),
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

  describe('submitSubmission', () => {
    const docFile = {
      buffer: Buffer.from('doc'),
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const selfieFile = {
      buffer: Buffer.from('selfie'),
      mimetype: 'image/png',
    } as Express.Multer.File;

    it('throws when the doc file is missing', async () => {
      await expect(
        service.submitSubmission(
          'user-1',
          { docType: KycDocType.NATIONAL_ID },
          { selfie: [selfieFile] },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(uploadsService.uploadImage).not.toHaveBeenCalled();
      expect(submissionRepository.save).not.toHaveBeenCalled();
    });

    it('throws when the selfie file is missing', async () => {
      await expect(
        service.submitSubmission(
          'user-1',
          { docType: KycDocType.NATIONAL_ID },
          { doc: [docFile] },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(uploadsService.uploadImage).not.toHaveBeenCalled();
    });

    it('throws when a file is not an image', async () => {
      await expect(
        service.submitSubmission(
          'user-1',
          { docType: KycDocType.NATIONAL_ID },
          {
            doc: [{ ...docFile, mimetype: 'application/pdf' }],
            selfie: [selfieFile],
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(uploadsService.uploadImage).not.toHaveBeenCalled();
    });

    it('throws when the user already has a submission in progress', async () => {
      submissionRepository.findOne.mockResolvedValue({
        id: 'existing',
        userId: 'user-1',
        status: KycSubmissionStatus.PENDING,
      } as KycSubmission);

      await expect(
        service.submitSubmission(
          'user-1',
          { docType: KycDocType.NATIONAL_ID },
          { doc: [docFile], selfie: [selfieFile] },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(uploadsService.uploadImage).not.toHaveBeenCalled();
    });

    it('uploads both images and creates a pending submission', async () => {
      submissionRepository.findOne.mockResolvedValue(null);
      uploadsService.uploadImage.mockImplementation((file) =>
        Promise.resolve({
          url: `https://cdn.example.com/${file.mimetype}`,
          publicId: 'public-id',
        }),
      );
      submissionRepository.create.mockImplementation(
        (value) => value as KycSubmission,
      );
      submissionRepository.save.mockImplementation((value) =>
        Promise.resolve({ id: 'new-submission', ...value } as KycSubmission),
      );

      const result = await service.submitSubmission(
        'user-1',
        { docType: KycDocType.PASSPORT },
        { doc: [docFile], selfie: [selfieFile] },
      );

      expect(uploadsService.uploadImage).toHaveBeenCalledWith(
        docFile,
        'kyc/documents',
      );
      expect(uploadsService.uploadImage).toHaveBeenCalledWith(
        selfieFile,
        'kyc/selfies',
      );

      expect(submissionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          docType: KycDocType.PASSPORT,
          docUrl: 'https://cdn.example.com/image/jpeg',
          selfieUrl: 'https://cdn.example.com/image/png',
          status: KycSubmissionStatus.PENDING,
        }),
      );

      expect(submissionRepository.save).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        kycStatus: KycStatus.PENDING,
      });
      expect(result.data).toEqual(
        expect.objectContaining({ id: 'new-submission' }),
      );
    });

    it('allows resubmission after a previous submission was rejected', async () => {
      submissionRepository.findOne.mockResolvedValue({
        id: 'old-submission',
        userId: 'user-1',
        status: KycSubmissionStatus.REJECTED,
      } as KycSubmission);
      uploadsService.uploadImage.mockResolvedValue({
        url: 'https://cdn.example.com/img',
        publicId: 'public-id',
      });
      submissionRepository.create.mockImplementation(
        (value) => value as KycSubmission,
      );
      submissionRepository.save.mockImplementation((value) =>
        Promise.resolve({ id: 'new-submission', ...value } as KycSubmission),
      );

      await expect(
        service.submitSubmission(
          'user-1',
          { docType: KycDocType.NATIONAL_ID },
          { doc: [docFile], selfie: [selfieFile] },
        ),
      ).resolves.toBeDefined();

      expect(uploadsService.uploadImage).toHaveBeenCalled();
      expect(submissionRepository.save).toHaveBeenCalled();
    });
  });
});
