import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeepseekService } from '../deepseek/deepseek.service.js';
import { EventsService } from '../events/events.service.js';

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
    const res = await this.events.upsertMany(items.map((i) => ({ ...i, city: '杭州' })));
    this.logger.log(`DeepSeek sync done for ${targetDate}. inserted=${res.inserted}, updated=${res.updated}`);
  }
}
