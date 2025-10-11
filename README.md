# DS Events (DeepSeek Hangzhou Events)

## 项目结构
- **backend/** NestJS + TypeORM + MySQL，包含每日 09:00 定时任务，调用 DeepSeek 抓取“当天的下周同一天”的展会/演唱会数据
- **frontend/** React + Vite（待生成），用于浏览与筛选事件
- **docker-compose.yml** 本地 MySQL 与 Adminer（可选）

## 快速开始

### 1) 启动 MySQL（推荐 Docker）
```bash
docker compose up -d
```
MySQL: localhost:3306，用户名 app / 密码 app123，数据库 ds_events。
Adminer: http://localhost:8080

### 2) 配置后端并运行
```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 等
npm install
npm run dev
```
后端启动于 http://localhost:3000

### 3) API 说明
- `GET /events?type=expo|concert&city=杭州&q=关键词&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=10`
- `POST /events/sync?city=杭州` 手动触发一次 DeepSeek 抓取并入库

### 4) 定时任务
- 每天 09:00 Asia/Shanghai 自动抓取 `city=杭州` 对应 “当天的下周同一天” 数据并入库

### 5) 前端（将随后提供）
- Vite + React。展示事件列表、支持城市切换、类型/日期/关键词筛选。

## 注意
- 首次运行建议用 `POST /events/sync` 手动拉取一次，确认数据结构与解析正常。
- 如需切换城市，前端查询参数 `city` 即可；定时任务默认杭州，可扩展多城市。
