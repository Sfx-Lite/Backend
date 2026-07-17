import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
// TODO: uncomment once Squad A's JwtAuthGuard exists — see auth.module.ts
// @UseGuards(JwtAuthGuard)
@Controller('events')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post()
  async create(@Body() dto: CreateEventDto, @CurrentUser('id') userId: string) {
    return this.analyticsService.logEvent(dto, userId);
  }
}
