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

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly openAICompat: boolean;

  constructor(private readonly cfg: ConfigService) {
    this.endpoint = cfg.get<string>('DEEPSEEK_ENDPOINT', 'https://api.deepseek.com/v1');
    this.model = cfg.get<string>('DEEPSEEK_MODEL', 'deepseek-chat');
    this.apiKey = cfg.get<string>('DEEPSEEK_API_KEY');
    this.openAICompat = cfg.get<string>('DEEPSEEK_PROTOCOL', 'openai') === 'openai';
  }

  private buildPrompt(city: string, targetDateISO: string) {
    return `请你根据公开渠道，列出${city}在日期 ${targetDateISO}（该日所在周的当天）相关的展会(expo)与演唱会(concert)。
严格输出 JSON 数组，不要有任何多余文本。每个元素必须包含：
{"title","type","venue","address","start_date","end_date","source_url","price_range","organizer"}
要求：
- type 只能是 "expo" 或 "concert"
- 日期格式 YYYY-MM-DD
- city 不需要返回（后端会填充）
- 若未知字段请用 null
- 严格 JSON，禁止 markdown 代码块标记`;
  }

  private extractJSONArray(text: string): any[] | null {
    // Try to find first JSON array in text
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      try {
        const parsed = JSON.parse(slice);
        return Array.isArray(parsed) ? parsed : null;
      } catch {}
    }
    return null;
  }

  async fetchEvents(city = '杭州', targetDate?: string) {
    const date = targetDate ?? dayjs().add(7, 'day').format('YYYY-MM-DD');
    const prompt = this.buildPrompt(city, date);

    if (!this.apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY is not set. Returning empty list.');
      return { items: [], targetDate: date };
    }

    try {
      let content = '';
      if (this.openAICompat) {
        const res = await fetch(`${this.endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: 'You are a data API. Respond with strict JSON only.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
          }),
        });
        const data: any = await res.json();
        content = data?.choices?.[0]?.message?.content ?? '';
      } else {
        // Non-OpenAI protocol placeholder
        const res = await fetch(`${this.endpoint}/chat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.model, input: prompt }),
        });
        const data: any = await res.json();
        content = data?.output ?? '';
      }

      let jsonArr: unknown;
      try {
        jsonArr = JSON.parse(content);
      } catch {
        jsonArr = this.extractJSONArray(content) ?? [];
      }

      if (!Array.isArray(jsonArr)) jsonArr = [];

      const parsed: ParsedEvent[] = [];
      for (const item of jsonArr as any[]) {
        const safe = EventSchema.safeParse(item);
        if (safe.success) {
          parsed.push(safe.data);
        } else {
          this.logger.debug(`Dropped invalid item: ${JSON.stringify(item).slice(0, 300)}`);
        }
      }

      return { items: parsed, targetDate: date };
    } catch (e: any) {
      this.logger.error('DeepSeek request failed', e?.response?.data ?? e?.message ?? e);
      return { items: [], targetDate: date };
    }
  }
}
