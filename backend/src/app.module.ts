import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Event } from './events/event.entity';
import { EventsModule } from './events/events.module';
import { DeepseekService } from './deepseek/deepseek.service';
import { TasksService } from './scheduler/tasks.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get<string>('DB_HOST', '127.0.0.1'),
        port: parseInt(cfg.get<string>('DB_PORT', '3306'), 10),
        username: cfg.get<string>('DB_USER', 'app'),
        password: cfg.get<string>('DB_PASS', 'app123'),
        database: cfg.get<string>('DB_NAME', 'ds_events'),
        entities: [Event],
        synchronize: true,
        timezone: '+08:00',
        charset: 'utf8mb4',
      }),
    }),
    ScheduleModule.forRoot(),
    EventsModule,
  ],
  providers: [DeepseekService, TasksService],
})
export class AppModule {}
