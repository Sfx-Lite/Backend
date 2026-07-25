import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { sendResponse } from '../../common/utils/response.util';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsController — Squad A.
 * ──────────────────────────────────
 * Read-side of the notifications module (BE-27). The caller's own id is
 * always read from the JWT (`sub`) — never trusted from params/body — so a
 * user can only ever list or mark-read their own notifications.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /api/v1/notifications
  @Get()
  @ApiOperation({
    summary: "List the current user's notifications (newest first)",
    description:
      'Supports paging (limit/offset) and an unreadOnly filter. Also returns ' +
      'unreadCount, independent of paging/filtering, for a badge count.',
  })
  @ApiOkResponse({
    description: 'Paginated notifications, newest first.',
    schema: {
      example: {
        status: true,
        message: 'Notifications',
        data: {
          items: [
            {
              id: '3f0c1e2a-9b7d-4c3e-8a1f-2b6d5e4c7a90',
              type: 'kyc',
              title: 'Identity verified',
              body: 'Your KYC submission has been approved.',
              readAt: null,
              createdAt: '2026-07-24T12:30:00.000Z',
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
          unreadCount: 1,
        },
      },
    },
  })
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const page = await this.notifications.listForUser(userId, query);
    return sendResponse(page, 'Notifications');
  }

  // PATCH /api/v1/notifications/:id/read
  @Patch(':id/read')
  @ApiOperation({
    summary: "Mark one of the current user's notifications as read",
  })
  @ApiNotFoundResponse({
    description: 'No notification with that id belongs to the caller.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Notification not found',
        error: 'Not Found',
      },
    },
  })
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const notification = await this.notifications.markAsRead(userId, id);
    return sendResponse(notification, 'Notification marked as read');
  }

  // PATCH /api/v1/notifications/read-all
  @Patch('read-all')
  @ApiOperation({
    summary: "Mark all of the current user's unread notifications as read",
  })
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    if (!userId) {
      throw new UnauthorizedException();
    }

    const result = await this.notifications.markAllAsRead(userId);
    return sendResponse(result, 'All notifications marked as read');
  }
}
