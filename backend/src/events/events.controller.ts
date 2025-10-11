import { Controller, Get, Post, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { QueryEventsDto } from './dto/query-events.dto';
import { DeepseekService } from '../deepseek/deepseek.service';

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
    const normalized = items.map((i) => ({
      title: i.title,
      type: i.type,
      city,
      venue: i.venue ?? null,
      address: i.address ?? null,
      start_date: i.start_date,
      end_date: i.end_date ?? null,
      source_url: i.source_url ?? null,
      price_range: i.price_range ?? null,
      organizer: i.organizer ?? null,
    }));
    const res = await this.events.upsertMany(normalized);
    return { targetDate, ...res };
  }
}
