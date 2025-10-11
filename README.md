# DS Events (DeepSeek Hangzhou Events)

## 项目结构
- **backend/** NestJS + TypeORM + MySQL，包含每日 09:00 定时任务，调用 DeepSeek 抓取“当天的下周同一天”的展会/演唱会数据
- **frontend/** React + Vite（待生成），用于浏览与筛选事件
- **docker-compose.yml** Docker 编排（MySQL、Adminer、Nginx、Backend）

## 快速开始

### 1) 前端构建
```bash
cd frontend
echo "VITE_API_BASE=http://<你的IP或域名>/api" > .env.production
pnpm install
pnpm run build
```
构建产物将输出到 `frontend/dist/`，由 Nginx 容器托管。

### 2) 启动 Docker（MySQL + Adminer + Nginx + Backend）
```bash
cd ..
docker compose up -d
```
服务：
- MySQL: `localhost:3306`（用户名 `app` / 密码 `app123` / 数据库 `ds_events`）
- Adminer: `http://localhost:8080`
- 前端站点: `http://localhost`
- API（经 Nginx 反代）: `http://localhost/api/*`

### 3) API 说明
- `GET /events?type=expo|concert&city=杭州&q=关键词&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=10`
- `POST /events/sync?city=杭州` 手动触发一次 DeepSeek 抓取并入库

### 4) 定时任务
- 每天 09:00 Asia/Shanghai 自动抓取 `city=杭州` 对应 “当天的下周同一天” 数据并入库

### 5) 前端
- Vite + React。展示事件列表、支持城市切换、类型/日期/关键词筛选。

## 注意
- 首次运行建议用 `POST /events/sync` 手动拉取一次，确认数据结构与解析正常。
- 如需切换城市，前端查询参数 `city` 即可；定时任务默认杭州，可扩展多城市。

## 部署与运行（Docker 全栈）

- **准备后端环境变量**：复制并编辑 `backend/.env`，填入真实的 `DEEPSEEK_API_KEY`。
```bash
cd backend
cp .env.example .env
# 编辑 .env：PORT/DB_* 保持默认；DEEPSEEK_* 根据实际填写
```

- **构建前端并启动容器**：
```bash
cd ../frontend
echo "VITE_API_BASE=http://<你的IP或域名>/api" > .env.production
pnpm install && pnpm run build

cd ..
docker compose pull
docker compose up -d
```

- **验证**：
```bash
# 首页
curl -I http://<你的IP或域名>
# API 反代
curl "http://<你的IP或域名>/api/events?page=1&pageSize=5"
# 手动同步
curl -X POST "http://<你的IP或域名>/api/events/sync?city=杭州"
```

- **日志**：
```bash
docker compose logs -f backend
docker compose logs -f nginx
docker compose logs -f mysql
```
