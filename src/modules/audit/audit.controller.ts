import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { sendResponse } from '../../common/utils/response.util';
import { UserRole } from '../users/enums/user-role.enum';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

/** A representative audit row, for Swagger examples. */
const EXAMPLE_AUDIT_LOG = {
  id: 'd4c3b2a1-e5f6-7890-abcd-ef1234567890',
  actorId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  category: 'kyc',
  level: 'medium',
  action: 'kyc.approved',
  entity: 'kyc_submission',
  entityId: '7c9e6f81-2a3b-4d5e-9f0a-1b2c3d4e5f60',
  metadata: { previousStatus: 'under_review', newStatus: 'approved' },
  createdAt: '2026-07-24T12:30:00.000Z',
  updatedAt: '2026-07-24T12:30:00.000Z',
};

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List audit-log entries (admin)',
    description:
      'Admin-only. Returns the platform audit trail newest-first. Supports ' +
      'limit/offset paging and filtering by category (slug), level (severity), ' +
      'actor, entity and a created_at date range (from/to).',
  })
  @ApiOkResponse({
    description: 'Audit trail retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'Audit logs retrieved successfully',
        data: {
          items: [EXAMPLE_AUDIT_LOG],
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  async list(@Query() query: ListAuditLogsQueryDto) {
    const page = await this.audit.list(query);
    return sendResponse(page, 'Audit logs retrieved successfully');
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get a single audit-log entry (admin)',
    description: 'Admin-only. Returns the full detail of one audit event.',
  })
  @ApiParam({
    name: 'id',
    description: 'The audit log’s UUID.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Audit log retrieved successfully.',
    schema: {
      example: {
        status: true,
        message: 'Audit log retrieved successfully',
        data: EXAMPLE_AUDIT_LOG,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  @ApiNotFoundResponse({ description: 'No audit log with that id.' })
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const log = await this.audit.findById(id);
    return sendResponse(log, 'Audit log retrieved successfully');
  }
}
