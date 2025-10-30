import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 事件实体
 * 
 * 存储展会和演唱会等事件信息
 * 支持多城市、多类型的事件管理
 * 
 * 特性：
 * - 使用hash字段防止重复数据
 * - 支持单日和多日跨度的事件
 * - 包含完整的事件元数据信息
 */
@Entity({ name: 'events' })
@Index(['hash'], { unique: true }) // 防止重复事件
export class Event {
  /** 主键 ID */
  @PrimaryGeneratedColumn()
  id!: number;

  /** 事件标题，最大300字符 */
  @Column({ length: 300 })
  title!: string;

  /** 
   * 事件类型
   * - expo: 展会、博览会、交易会等
   * - concert: 演唱会、音乐会等
   */
  @Column({ length: 20 })
  type!: 'expo' | 'concert';

  /** 事件所在城市，默认为杭州 */
  @Column({ length: 50, default: '杭州' })
  city!: string;

  /** 事件举办场馆名称 */
  @Column({ type: 'varchar', length: 200, nullable: true })
  venue!: string | null;

  /** 事件举办的详细地址 */
  @Column({ type: 'varchar', length: 300, nullable: true })
  address!: string | null;

  /** 事件开始日期，格式: YYYY-MM-DD */
  @Column({ type: 'date' })
  start_date!: string;

  /** 事件结束日期（单日事件为null），格式: YYYY-MM-DD */
  @Column({ type: 'date', nullable: true })
  end_date!: string | null;

  /** 事件信息来源网址 */
  @Column({ type: 'varchar', length: 500, nullable: true })
  source_url!: string | null;

  /** 价格范围，例: "免费" 或 "100-500元" */
  @Column({ type: 'varchar', length: 100, nullable: true })
  price_range!: string | null;

  /** 主办方或组织者名称 */
  @Column({ type: 'varchar', length: 200, nullable: true })
  organizer!: string | null;

  /** 
   * 事件唯一标识哈希值
   * 基于 title|start_date|venue|city 生成的 MD5 值
   * 用于防止重复数据的插入
   */
  @Column({ length: 128 })
  hash!: string;

  /** 记录创建时间 */
  @CreateDateColumn()
  created_at!: Date;

  /** 记录更新时间 */
  @UpdateDateColumn()
  updated_at!: Date;
}
