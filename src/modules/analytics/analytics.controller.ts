import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.analyticsService.logEvent(dto, userId, role);
  }
}