import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity.js';
import crypto from 'crypto';
import { QueryEventsDto } from './dto/query-events.dto.js';

export type EventInput = Omit<Event, 'id' | 'created_at' | 'updated_at' | 'hash'> & { hash?: string };

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly repo: Repository<Event>,
  ) {}

  private computeHash(e: EventInput) {
    const base = `${e.title}|${e.start_date}|${e.venue ?? ''}|${e.city ?? ''}`;
    return crypto.createHash('md5').update(base).digest('hex');
  }

  async upsertMany(items: EventInput[]) {
    const rows = items.map((e) => ({ ...e, hash: e.hash ?? this.computeHash(e) }));
    if (rows.length === 0) return { inserted: 0, updated: 0 };

    // Upsert by unique hash
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(Event)
      .values(rows)
      .orUpdate(['title', 'type', 'city', 'venue', 'address', 'start_date', 'end_date', 'source_url', 'price_range', 'organizer', 'updated_at'], ['hash'])
      .execute();

    // TypeORM doesn't return exact updated count easily; approximate
    return { inserted: result.identifiers.length, updated: rows.length - result.identifiers.length };
  }

  async list(q: QueryEventsDto) {
    const qb = this.repo.createQueryBuilder('e');

    if (q.type) qb.andWhere('e.type = :type', { type: q.type });
    if (q.city) qb.andWhere('e.city = :city', { city: q.city });
    if (q.q) qb.andWhere('(e.title LIKE :kw OR e.venue LIKE :kw OR e.address LIKE :kw)', { kw: `%${q.q}%` });
    if (q.from) qb.andWhere('e.start_date >= :from', { from: q.from });
    if (q.to) qb.andWhere('(e.end_date IS NULL AND e.start_date <= :to) OR (e.end_date IS NOT NULL AND e.end_date <= :to)', { to: q.to });

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 10;

    qb.orderBy('e.start_date', 'ASC').skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }
}
