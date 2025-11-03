import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import crypto from 'crypto';
import { QueryEventsDto } from './dto/query-events.dto';

/**
 * 事件输入数据类型
 * 用于创建或更新事件时的数据结构
 */
export type EventInput = Omit<Event, 'id' | 'created_at' | 'updated_at' | 'hash'> & { hash?: string };

/**
 * 批量操作结果
 */
export interface UpsertResult {
  inserted: number;
  updated: number;
}

/**
 * 事件查询结果
 */
export interface EventQueryResult {
  items: Event[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  /**
   * 计算事件的唯一标识
   * 
   * 基于标题、开始日期、场馆和城市生成 MD5 哈希值
   * 用于防止重复事件的插入
   * 
   * @param eventData 事件数据
   * @returns MD5 哈希字符串
   */
  private calculateEventHash(eventData: EventInput): string {
    const hashComponents = [
      eventData.title,
      eventData.start_date,
      eventData.venue ?? '',
      eventData.city ?? ''
    ];
    
    const baseString = hashComponents.join('|');
    return crypto.createHash('md5').update(baseString).digest('hex');
  }

  /**
   * 批量插入或更新事件
   * 
   * 根据事件的 hash 值判断是新增还是更新
   * 如果 hash 已存在，则更新现有记录
   * 如果 hash 不存在，则插入新记录
   * 
   * @param eventInputs 事件数据数组
   * @returns 操作结果，包含插入和更新的数量
   */
  async upsertManyEvents(eventInputs: EventInput[]): Promise<UpsertResult> {
    if (eventInputs.length === 0) {
      this.logger.warn('尝试批量更新空的事件列表');
      return { inserted: 0, updated: 0 };
    }

    // 为每个事件计算 hash（如果没有提供）
    const eventsWithHash = eventInputs.map((eventData) => ({
      ...eventData,
      hash: eventData.hash ?? this.calculateEventHash(eventData)
    }));

    this.logger.log(`开始批量更新 ${eventsWithHash.length} 个事件`);

    try {
      // 基于 hash 字段进行 upsert 操作
      const result = await this.eventRepository
        .createQueryBuilder()
        .insert()
        .into(Event)
        .values(eventsWithHash)
        .orUpdate([
          'title', 'type', 'city', 'venue', 'address', 
          'start_date', 'end_date', 'source_url', 
          'price_range', 'organizer', 'updated_at'
        ], ['hash'])
        .execute();

      // TypeORM 无法精确返回更新数量，这里做近似计算
      const insertedCount = result.identifiers.length;
      const updatedCount = eventsWithHash.length - insertedCount;
      
      this.logger.log(`事件批量更新完成: 新增 ${insertedCount} 个，更新 ${updatedCount} 个`);
      
      return { inserted: insertedCount, updated: updatedCount };
    } catch (error) {
      this.logger.error('批量更新事件失败', error);
      throw new Error(`批量更新事件失败: ${error.message}`);
    }
  }

  /**
   * 分页查询事件列表
   * 
   * 支持多种过滤条件：类型、城市、关键词搜索、日期范围等
   * 
   * @param queryOptions 查询选项
   * @returns 分页的事件查询结果
   */
  async findEventsWithPagination(queryOptions: QueryEventsDto): Promise<EventQueryResult> {
    const queryBuilder = this.eventRepository.createQueryBuilder('event');

    // 根据事件类型筛选
    if (queryOptions.type) {
      queryBuilder.andWhere('event.type = :type', { type: queryOptions.type });
    }

    // 根据城市筛选
    if (queryOptions.city) {
      queryBuilder.andWhere('event.city = :city', { city: queryOptions.city });
    }

    // 关键词搜索（标题、场馆、地址）
    if (queryOptions.q) {
      queryBuilder.andWhere(
        '(event.title LIKE :keyword OR event.venue LIKE :keyword OR event.address LIKE :keyword)',
        { keyword: `%${queryOptions.q}%` }
      );
    }

    // 日期范围筛选
    this.applyDateRangeFilter(queryBuilder, queryOptions);

    // 分页设置
    const currentPage = queryOptions.page ?? 1;
    const itemsPerPage = queryOptions.pageSize ?? 10;
    const skipCount = (currentPage - 1) * itemsPerPage;

    queryBuilder
      .orderBy('event.start_date', 'ASC')
      .skip(skipCount)
      .take(itemsPerPage);

    const [events, totalCount] = await queryBuilder.getManyAndCount();
    
    this.logger.log(`查询事件列表: 第${currentPage}页，每页${itemsPerPage}个，共${totalCount}个结果`);
    
    return {
      items: events,
      total: totalCount,
      page: currentPage,
      pageSize: itemsPerPage
    };
  }

  /**
   * 应用日期范围筛选条件
   * 
   * 逻辑说明：筛选出与查询时间段 [from, to] 有重叠的活动
   * 
   * 重叠条件：
   * 1. 活动开始日期 <= 查询结束日期（to）
   * 2. 活动结束日期 >= 查询开始日期（from）
   * 
   * 对于单日活动（end_date 为 NULL），将 start_date 视为结束日期
   * 
   * @param queryBuilder 查询构建器
   * @param options 查询选项
   */
  private applyDateRangeFilter(queryBuilder: any, options: QueryEventsDto): void {
    if (options.from && options.to) {
      // 同时有起止日期：筛选与 [from, to] 有重叠的活动
      queryBuilder.andWhere(
        'event.start_date <= :toDate AND ' +
        '((event.end_date IS NULL AND event.start_date >= :fromDate) OR ' +
        '(event.end_date IS NOT NULL AND event.end_date >= :fromDate))',
        { fromDate: options.from, toDate: options.to }
      );
    } else if (options.from) {
      // 只有起始日期：筛选在 from 之后结束的活动
      queryBuilder.andWhere(
        '(event.end_date IS NULL AND event.start_date >= :fromDate) OR ' +
        '(event.end_date IS NOT NULL AND event.end_date >= :fromDate)',
        { fromDate: options.from }
      );
    } else if (options.to) {
      // 只有结束日期：筛选在 to 之前开始的活动
      queryBuilder.andWhere('event.start_date <= :toDate', { toDate: options.to });
    }
  }
  // 保持向后兼容的方法名
  async upsertMany(items: EventInput[]): Promise<UpsertResult> {
    return this.upsertManyEvents(items);
  }

  async list(queryOptions: QueryEventsDto): Promise<EventQueryResult> {
    return this.findEventsWithPagination(queryOptions);
  }
}
