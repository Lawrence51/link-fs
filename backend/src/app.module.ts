import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Event } from './events/event.entity';
import { EventsModule } from './events/events.module';
import { DeepseekService } from './deepseek/deepseek.service';
import { TasksService } from './scheduler/tasks.service';

/**
 * 应用主模块
 * 
 * 整合所有功能模块，配置全局服务：
 * - 数据库连接 (MySQL)
 * - 配置管理 (环境变量)
 * - 定时任务调度
 * - 事件管理模块
 * - AI服务集成
 */
@Module({
  imports: [
    // 全局配置模块，从环境变量加载配置
    ConfigModule.forRoot({ isGlobal: true }),
    
    // 数据库连接配置
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', '127.0.0.1'),
        port: parseInt(configService.get<string>('DB_PORT', '3306'), 10),
        username: configService.get<string>('DB_USER', 'app'),
        password: configService.get<string>('DB_PASS', 'app123'),
        database: configService.get<string>('DB_NAME', 'ds_events'),
        entities: [Event], // 数据库实体列表
        synchronize: true, // 开发环境自动同步表结构（生产环境请设为false）
        timezone: '+08:00', // 中国时区
        charset: 'utf8mb4', // 支持emoji和复杂字符
        logging: ['error'], // 只记录错误日志
      }),
    }),
    
    // 定时任务模块
    ScheduleModule.forRoot(),
    
    // 事件管理模块
    EventsModule,
  ],
  
  // 全局服务提供者
  providers: [
    DeepseekService, // AI服务
    TasksService,    // 定时任务服务
  ],
})
export class AppModule {}
