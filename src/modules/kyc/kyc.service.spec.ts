import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { KycSubmission } from './entities/kyc-submission.entity';
import { KycSubmissionStatus } from './enums/kyc-submission-status.enum';
import { KycService } from './kyc.service';

describe('KycService', () => {
  let service: KycService;
  let repository: jest.Mocked<
    Pick<Repository<KycSubmission>, 'findOne' | 'save'>
  >;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: getRepositoryToken(KycSubmission),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  it('throws when the KYC submission does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.reviewSubmission(
        'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
        '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        {
          status: KycSubmissionStatus.APPROVED,
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('approves an under-review submission', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      status: KycSubmissionStatus.UNDER_REVIEW,
      reason: 'Old reason',
      reviewedBy: null,
      reviewedAt: null,
    } as KycSubmission;

    repository.findOne.mockResolvedValue(submission);
    repository.save.mockImplementation((value: KycSubmission) =>
      Promise.resolve(value),
    );

    await service.reviewSubmission(
      submission.id,
      '67638e0d-6835-4d54-875a-f6bdb3910ee6',
      {
        status: KycSubmissionStatus.APPROVED,
      },
    );

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: KycSubmissionStatus.APPROVED,
        reviewedBy: '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        reason: null,
      }),
    );

    expect(submission.reviewedAt).toBeInstanceOf(Date);
  });

  it('rejects an under-review submission and stores the reason', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      status: KycSubmissionStatus.UNDER_REVIEW,
      reason: null,
      reviewedBy: null,
      reviewedAt: null,
    } as KycSubmission;

    repository.findOne.mockResolvedValue(submission);
    repository.save.mockImplementation((value: KycSubmission) =>
      Promise.resolve(value),
    );

    await service.reviewSubmission(
      submission.id,
      '67638e0d-6835-4d54-875a-f6bdb3910ee6',
      {
        status: KycSubmissionStatus.REJECTED,
        reason: 'Document image is unreadable',
      },
    );

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: KycSubmissionStatus.REJECTED,
        reviewedBy: '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        reason: 'Document image is unreadable',
      }),
    );

    expect(submission.reviewedAt).toBeInstanceOf(Date);
  });

  it('rejects an invalid status transition', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      status: KycSubmissionStatus.PENDING,
    } as KycSubmission;

    repository.findOne.mockResolvedValue(submission);

    await expect(
      service.reviewSubmission(
        submission.id,
        '67638e0d-6835-4d54-875a-f6bdb3910ee6',
        {
          status: KycSubmissionStatus.APPROVED,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects a reason when approving a submission', async () => {
    const submission = {
      id: 'f295b04a-b8e0-4ca6-83d0-1edc8a840e91',
      status: KycSubmissionStatus.UNDER_REVIEW,
    } as KycSubmission;

    repository.findOne.mockResolvedValue(submission);

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

    expect(repository.save).not.toHaveBeenCalled();
  });
});
