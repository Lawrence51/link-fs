import { Controller, Get, Post, Query } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { QueryEventsDto } from './dto/query-events.dto.js';
import { DeepseekService } from '../deepseek/deepseek.service.js';

@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly deepseek: DeepseekService,
  ) {}

  @Get()
  async list(@Query() query: QueryEventsDto) {
    return this.events.list(query);
  }

  @Post('sync')
  async sync(@Query('city') city = '杭州') {
    const { items, targetDate } = await this.deepseek.fetchEvents(city);
    const res = await this.events.upsertMany(items.map((i) => ({ ...i, city })));
    return { targetDate, ...res };
  }
}
