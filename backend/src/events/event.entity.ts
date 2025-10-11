import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'events' })
@Index(['hash'], { unique: true })
export class Event {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 300 })
  title!: string;

  @Column({ length: 20 })
  type!: 'expo' | 'concert';

  @Column({ length: 50, default: '杭州' })
  city!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  venue!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address!: string | null;

  @Column({ type: 'date' })
  start_date!: string; // YYYY-MM-DD

  @Column({ type: 'date', nullable: true })
  end_date!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  source_url!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  price_range!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  organizer!: string | null;

  @Column({ length: 128 })
  hash!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
