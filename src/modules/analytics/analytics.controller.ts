import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { AnalyticsService } from './analytics.service';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics/events')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post()
  @ApiOperation({
    summary: 'Log a behavioral analytics event',
    description:
      'Records an analytics event for the authenticated caller. The user id ' +
      'and actor surface (user vs admin) are derived server-side from the ' +
      'access token and are never trusted from the request body.',
  })
  @ApiBody({ type: CreateEventDto })
  @ApiCreatedResponse({
    description: 'Event logged successfully.',
    schema: {
      example: {
        status: true,
        message: 'Event logged successfully',
        data: {
          id: '5d7e9f01-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
          userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          eventName: 'signup_completed',
          actorType: 'user',
          sessionId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          properties: { reason: 'blurry_document' },
          createdAt: '2026-07-24T12:30:00.000Z',
          updatedAt: '2026-07-24T12:30:00.000Z',
        },
      },
    },
  })
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.analyticsService.logEvent(dto, userId, role);
  }
}
