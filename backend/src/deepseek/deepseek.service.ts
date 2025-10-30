import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import dayjs from 'dayjs';

const EventSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['expo', 'concert']),
  venue: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  source_url: z.string().url().optional().nullable(),
  price_range: z.string().optional().nullable(),
  organizer: z.string().optional().nullable(),
});

export type ParsedEvent = z.infer<typeof EventSchema>;

/**
 * AI事件数据获取结果
 */
export interface EventFetchResult {
  items: ParsedEvent[];
  targetDate: string;
}

/**
 * DeepSeek API配置
 */
interface DeepSeekConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
  isOpenAICompatible: boolean;
}

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly config: DeepSeekConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * 加载DeepSeek配置
   */
  private loadConfiguration(): DeepSeekConfig {
    return {
      endpoint: this.configService.get<string>('DEEPSEEK_ENDPOINT', 'https://api.deepseek.com/v1'),
      model: this.configService.get<string>('DEEPSEEK_MODEL', 'deepseek-chat'),
      apiKey: this.configService.get<string>('DEEPSEEK_API_KEY'),
      isOpenAICompatible: this.configService.get<string>('DEEPSEEK_PROTOCOL', 'openai') === 'openai'
    };
  }

  /**
   * 验证配置有效性
   */
  private validateConfiguration(): void {
    if (!this.config.apiKey) {
      this.logger.warn('⚠️  DEEPSEEK_API_KEY未设置，将返回空的事件列表');
    }
  }

  /**
   * 构建AI查询提示词
   * 
   * 生成用于查询指定城市和日期的事件信息的提示词
   * 要求AI返回结构化的JSON数据
   * 
   * @param city 目标城市
   * @param targetDate 目标日期
   * @returns 格式化的提示词
   */
  private buildEventQueryPrompt(city: string, targetDate: string): string {
    return `请你根据公开渠道，列出${city}在日期 ${targetDate}（该日所在周的当天）相关的展会(expo)与演唱会(concert)。

严格输出 JSON 数组，不要有任何多余文本。每个元素尽量包含：
{
  "title": "事件标题",
  "type": "expo" | "concert",
  "venue": "场馆名称",
  "address": "详细地址",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD 或 null",
  "source_url": "信息来源URL",
  "price_range": "价格范围",
  "organizer": "主办方"
}

要求：
- type 只能是 "expo" 或 "concert"
- 所有日期格式必须是 YYYY-MM-DD
- city 不需要返回（后端会自动填充）
- 未知字段请使用 null
- 严格返回JSON格式，禁止使用markdown代码块标记`;
  }

  /**
   * 从AI响应文本中提取JSON数组
   * 
   * 由于AI可能返回带有额外文本的响应，此方法尝试提取其中的JSON数组部分
   * 
   * @param responseText AI返回的原始文本
   * @returns 解析出的数组，如果解析失败则返回null
   */
  private extractJsonArrayFromResponse(responseText: string): any[] | null {
    this.logger.debug(`正在解析AI响应: ${responseText.substring(0, 200)}...`);
    
    // 查找第一个JSON数组的开始和结束位置
    const arrayStart = responseText.indexOf('[');
    const arrayEnd = responseText.lastIndexOf(']');
    
    if (arrayStart === -1 || arrayEnd === -1 || arrayEnd <= arrayStart) {
      this.logger.warn('AI响应中未找到有效的JSON数组结构');
      return null;
    }

    const jsonString = responseText.slice(arrayStart, arrayEnd + 1);
    
    try {
      const parsedData = JSON.parse(jsonString);
      
      if (!Array.isArray(parsedData)) {
        this.logger.warn('解析出的数据不是数组格式');
        return null;
      }
      
      this.logger.debug(`成功解析出 ${parsedData.length} 个事件数据`);
      return parsedData;
    } catch (error) {
      this.logger.error('JSON解析失败', { error: error.message, jsonString });
      return null;
    }
  }

  /**
   * 从DeepSeek API获取指定城市的事件信息
   * 
   * @param city 目标城市，默认为杭州
   * @param targetDate 目标日期，默认为7天后
   * @returns 事件获取结果，包含事件列表和目标日期
   */
  async fetchEventsFromAI(city = '杭州', targetDate?: string): Promise<EventFetchResult> {
    const queryDate = targetDate ?? this.getDefaultTargetDate();
    
    this.logger.log(`🔍 开始获取 ${city} 在 ${queryDate} 的事件信息`);

    // 检查API密钥
    if (!this.config.apiKey) {
      this.logger.warn('⚠️  API密钥未设置，返回空结果');
      return { items: [], targetDate: queryDate };
    }

    try {
      const aiResponse = await this.callDeepSeekAPI(city, queryDate);
      const validatedEvents = await this.parseAndValidateEvents(aiResponse);
      
      this.logger.log(`✅ 成功获取并验证了 ${validatedEvents.length} 个有效事件`);
      
      return { items: validatedEvents, targetDate: queryDate };
    } catch (error) {
      this.logger.error('❌ 获取事件信息失败', {
        city,
        targetDate: queryDate,
        error: error.message
      });
      return { items: [], targetDate: queryDate };
    }
  }

  /**
   * 获取默认的目标日期（7天后）
   */
  private getDefaultTargetDate(): string {
    return dayjs().add(7, 'day').format('YYYY-MM-DD');
  }

  /**
   * 调用DeepSeek API
   */
  private async callDeepSeekAPI(city: string, targetDate: string): Promise<string> {
    const prompt = this.buildEventQueryPrompt(city, targetDate);
    
    if (this.config.isOpenAICompatible) {
      return this.callOpenAICompatibleAPI(prompt);
    } else {
      return this.callNativeDeepSeekAPI(prompt);
    }
  }

  /**
   * 调用OpenAI兼容的API
   */
  private async callOpenAICompatibleAPI(prompt: string): Promise<string> {
    const response = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { 
            role: 'system', 
            content: '你是一个专业的事件信息数据API。请严格按照要求返回JSON格式的数据，不要包含任何额外的文本或格式标记。' 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2, // 降低随机性，提高结果一致性
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API调用失败: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    return responseData?.choices?.[0]?.message?.content ?? '';
  }

  /**
   * 调用原生DeepSeek API（预留接口）
   */
  private async callNativeDeepSeekAPI(prompt: string): Promise<string> {
    const response = await fetch(`${this.config.endpoint}/chat`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${this.config.apiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        model: this.config.model, 
        input: prompt 
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek Native API调用失败: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    return responseData?.output ?? '';
  }

  /**
   * 解析并验证AI返回的事件数据
   */
  private async parseAndValidateEvents(aiResponse: string): Promise<ParsedEvent[]> {
    if (!aiResponse?.trim()) {
      this.logger.warn('AI返回了空的响应内容');
      return [];
    }

    // 尝试直接解析JSON
    let rawEventData: unknown;
    try {
      rawEventData = JSON.parse(aiResponse);
    } catch {
      // 如果直接解析失败，尝试提取JSON数组
      rawEventData = this.extractJsonArrayFromResponse(aiResponse) ?? [];
    }

    // 确保数据是数组格式
    if (!Array.isArray(rawEventData)) {
      this.logger.warn('AI返回的数据不是数组格式');
      return [];
    }

    // 验证并过滤有效的事件数据
    const validatedEvents: ParsedEvent[] = [];
    let invalidCount = 0;

    for (const item of rawEventData) {
      const validationResult = EventSchema.safeParse(item);
      
      if (validationResult.success) {
        validatedEvents.push(validationResult.data);
      } else {
        invalidCount++;
        this.logger.debug('发现无效的事件数据', {
          item: JSON.stringify(item).substring(0, 200),
          errors: validationResult.error.errors
        });
      }
    }

    if (invalidCount > 0) {
      this.logger.warn(`过滤掉 ${invalidCount} 个无效的事件数据`);
    }

    return validatedEvents;
  }

  // 保持向后兼容的方法名
  async fetchEvents(city = '杭州', targetDate?: string): Promise<EventFetchResult> {
    return this.fetchEventsFromAI(city, targetDate);
  }
}
