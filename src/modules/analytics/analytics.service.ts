import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { sendResponse } from '../../common/utils/response.util';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventsRepo: Repository<AnalyticsEvent>,
  ) {}

  async logEvent(dto: CreateEventDto, userId: string) {
    const event = this.eventsRepo.create({
      eventName: dto.eventName,
      sessionId: dto.sessionId,
      properties: dto.properties ?? {},
      userId,
      actorType: 'user',
    });

    const saved = await this.eventsRepo.save(event);

    return sendResponse(saved, 'Event logged successfully');
  }
}
