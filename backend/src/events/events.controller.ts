import { Controller, Get, Post, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { QueryEventsDto } from './dto/query-events.dto';
import { DeepseekService } from '../deepseek/deepseek.service';

/**
 * 事件管理控制器
 * 
 * 提供事件查询和数据同步的API接口
 * 支持从外部AI服务获取最新的展会和演唱会信息
 */
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly deepseekService: DeepseekService,
  ) {}

  /**
   * 获取事件列表
   * 
   * GET /events
   * 
   * 支持多种查询参数：
   * - type: 事件类型 (expo/concert)
   * - city: 城市名称
   * - q: 关键词搜索
   * - from/to: 日期范围
   * - page/pageSize: 分页参数
   * 
   * @param queryParams 查询参数
   * @returns 分页的事件列表
   */
  @Get()
  async getEventsList(@Query() queryParams: QueryEventsDto) {
    // 设置默认城市为杭州
    const searchCriteria: QueryEventsDto = { 
      ...queryParams, 
      city: queryParams.city ?? '杭州' 
    };
    
    return this.eventsService.findEventsWithPagination(searchCriteria);
  }

  /**
   * 同步事件数据
   * 
   * POST /events/sync?city=城市名称
   * 
   * 从DeepSeek AI服务获取指定城市的最新事件信息，
   * 并将数据同步到本地数据库中。
   * 
   * 该接口会：
   * 1. 调用AI服务获取事件数据
   * 2. 验证和清洗数据
   * 3. 批量更新到数据库（基于hash去重）
   * 4. 返回同步结果统计
   * 
   * @param city 目标城市，默认为杭州
   * @returns 同步结果，包含目标日期、新增和更新的数量
   */
  @Post('sync')
  async synchronizeEventsFromAI(@Query('city') city = '杭州') {
    // 1. 从AI服务获取事件数据
    const { items: aiEventData, targetDate } = await this.deepseekService.fetchEventsFromAI(city);
    
    if (aiEventData.length === 0) {
      return {
        targetDate,
        message: `未获取到 ${city} 的事件数据`,
        inserted: 0,
        updated: 0
      };
    }

    // 2. 转换数据格式以匹配数据库结构
    const eventsForDatabase = aiEventData.map((eventData) => ({
      title: eventData.title,
      type: eventData.type,
      city, // 填充城市信息
      venue: eventData.venue ?? null,
      address: eventData.address ?? null,
      start_date: eventData.start_date,
      end_date: eventData.end_date ?? null,
      source_url: eventData.source_url ?? null,
      price_range: eventData.price_range ?? null,
      organizer: eventData.organizer ?? null,
    }));

    // 3. 批量同步到数据库
    const syncResult = await this.eventsService.upsertManyEvents(eventsForDatabase);
    
    return {
      targetDate,
      message: `成功同步 ${city} 的事件数据`,
      ...syncResult
    };
  }
}
