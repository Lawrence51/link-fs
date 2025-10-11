import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeepseekService } from '../deepseek/deepseek.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    private readonly deepseek: DeepseekService,
    private readonly events: EventsService,
  ) {}

  // Every day at 09:00 Asia/Shanghai
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Asia/Shanghai' })
  async dailySync() {
    this.logger.log('Starting daily DeepSeek sync (city=杭州)');
    const { items, targetDate } = await this.deepseek.fetchEvents('杭州');
    const normalized = items.map((i) => ({
      title: i.title,
      type: i.type,
      city: '杭州',
      venue: i.venue ?? null,
      address: i.address ?? null,
      start_date: i.start_date,
      end_date: i.end_date ?? null,
      source_url: i.source_url ?? null,
      price_range: i.price_range ?? null,
      organizer: i.organizer ?? null,
    }));
    const res = await this.events.upsertMany(normalized);
    this.logger.log(`DeepSeek sync done for ${targetDate}. inserted=${res.inserted}, updated=${res.updated}`);
  }
}
