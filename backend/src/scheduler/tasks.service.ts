import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeepseekService } from '../deepseek/deepseek.service';
import { EventsService } from '../events/events.service';
import dayjs from 'dayjs';

/**
 * 定时任务服务
 * 
 * 负责执行系统的自动化任务，包括：
 * - 每日自动同步事件数据
 * - 数据库清理和维护任务
 * - 系统健康检查
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  
  constructor(
    private readonly deepseekService: DeepseekService,
    private readonly eventsService: EventsService,
  ) {
    this.logger.log('🔄 定时任务服务已初始化');
  }

  /**
   * 每日自动同步任务
   * 
   * 每天上午9:00（上海时区）自动执行，
   * 从七牛云 AI 获取最新的事件信息并同步到数据库。
   * 
   * 任务流程：
   * 1. 获取目标城市（优先使用环境变量CRON_CITY）
   * 2. 调用七牛云 AI 服务获取事件数据
   * 3. 使用七牛云进行数据验证（防止幻觉数据）
   * 4. 数据格式化
   * 5. 批量同步到数据库
   * 6. 记录同步结果
   */
  @Cron('0 0 18 * * *', { 
    name: 'daily-events-sync',
    timeZone: 'Asia/Shanghai' 
  })
  async performDailyEventSync() {
    const targetCity = this.getTargetCityForSync();
    const taskStartTime = new Date();
    
    this.logger.log(`🔄 开始每日事件同步任务 (city=${targetCity})`);

    try {
      // 1. 迭代未来30天，逐日获取事件
      const daysToFetch = 30;
      let totalFetched = 0;
      const aggregatedEvents: any[] = [];

      for (let i = 0; i < daysToFetch; i++) {
        const date = dayjs().add(i, 'day').format('YYYY-MM-DD');
        this.logger.log(`📅 获取 ${targetCity} 在 ${date} 的事件信息`);
        const { items } = await this.deepseekService.fetchEventsFromAI(targetCity, date);
        totalFetched += items.length;
        if (items.length > 0) {
          const formatted = this.formatEventsForDatabase(items, targetCity);
          aggregatedEvents.push(...formatted);
        }
      }

      if (aggregatedEvents.length === 0) {
        this.logger.warn(`⚠️  未来30天未获取到 ${targetCity} 的事件数据`);
        return;
      }

      // 2. 批量同步到数据库（去重由hash与upsert保证）
      const syncResult = await this.eventsService.upsertManyEvents(aggregatedEvents);

      // 3. 记录成功结果
      const taskDuration = new Date().getTime() - taskStartTime.getTime();
      this.logger.log(
        `✅ 每日同步任务完成 | 日期范围: 今天起未来30天 | ` +
        `抓取条目(含重复): ${totalFetched} | ` +
        `入库新增: ${syncResult.inserted} | 更新: ${syncResult.updated} | ` +
        `耗时: ${taskDuration}ms`
      );
      
    } catch (error) {
      this.logger.error('❌ 每日同步任务失败', {
        city: targetCity,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }

  /**
   * 获取目标同步城市
   * 优先使用环境变量，如果未设置则默认为杭州
   */
  private getTargetCityForSync(): string {
    const envCity = process.env.CRON_CITY;
    const defaultCity = '杭州';
    
    if (!envCity) {
      this.logger.debug(`环境变量CRON_CITY未设置，使用默认城市: ${defaultCity}`);
    }
    
    return envCity || defaultCity;
  }

  /**
   * 将AI返回的事件数据格式化为数据库结构
   */
  private formatEventsForDatabase(eventData: any[], city: string) {
    return eventData.map((event) => ({
      title: event.title,
      type: event.type,
      city,
      venue: event.venue ?? null,
      address: event.address ?? null,
      start_date: event.start_date,
      end_date: event.end_date ?? null,
      source_url: event.source_url ?? null,
      price_range: event.price_range ?? null,
      organizer: event.organizer ?? null,
    }));
  }

  // 保持向后兼容的方法名
  async dailySync() {
    return this.performDailyEventSync();
  }
}
