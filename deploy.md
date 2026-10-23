# 构建与容器化部署指南

本文说明如何从源码构建「错题本 · 家庭 AI 学习助手」，并通过 Docker Compose 启动完整服务栈（PostgreSQL、Redis、NestJS API、Nginx + Vue H5）。

> 容器部署不需要在宿主机安装 Node.js、pnpm、PostgreSQL 或 Chromium，这些依赖均在镜像内准备。本地非容器开发方式见 [README.md](./README.md)。

## 1. 部署架构

```
浏览器 / 手机
      │  http://<服务器IP>:8080
      ▼
┌─────────────────────────────┐
│ web (nginx:1.27-alpine)     │
│  · 托管 Vue 构建产物         │
│  · /api/ 反向代理到 api:3000 │
└──────────────┬──────────────┘
               │ Docker 内部网络
               ▼
┌─────────────────────────────┐
│ api (node:22-bookworm-slim) │
│  · NestJS 生产构建 dist/     │
│  · 启动前自动执行数据库迁移   │
│  · 内置 Chromium 用于 PDF    │
└───────┬─────────────┬───────┘
        │             │
        ▼             ▼
  postgres:16     redis:7（可选队列）
```

| 服务 | 镜像 | 对外端口 | 数据卷 |
| --- | --- | --- | --- |
| `web` | 本地构建 `myos-web` | `8080:80`（可配置） | 无 |
| `api` | 本地构建 `myos-api` | 仅容器内 `3000` | `storage`（试卷 PDF） |
| `postgres` | `postgres:16-alpine` | 不暴露 | `pgdata` |
| `redis` | `redis:7-alpine` | 不暴露 | `redisdata` |

API 与 Web 的 Dockerfile 均为多阶段构建：

- `apps/api/Dockerfile`：安装依赖 → 构建 `@myos/shared` 与 NestJS → 运行时安装 Chromium/CJK 字体 → 以非 root 用户启动。
- `apps/web/Dockerfile`：安装依赖 → 构建 `@myos/shared` 与 Vue → 产物复制进 Nginx。
- `apps/api/docker-entrypoint.sh`：先执行 `prisma migrate deploy`，按需执行 seed，再启动 `node dist/main.js`。

## 2. 环境要求

- Docker Engine 24+ 或 Docker Desktop，含 Docker Compose v2（`docker compose version` 可用）
- 建议至少 2 核 CPU、4 GB 内存、5 GB 可用磁盘（API 镜像含 Chromium，约 1.5 GB）
- 构建阶段需要访问 Docker Hub、npm registry 和 Playwright 浏览器下载源
- 若使用 PDF，运行时无需额外安装浏览器

检查环境：

```bash
docker --version
docker compose version
```

## 3. 获取源码并配置环境变量

```bash
git clone <仓库地址> myos
cd myos
cp .env.example .env
```

Compose 只读取**项目根目录的 `.env`**。`apps/api/.env` 仅用于宿主机本地开发，不会被复制进镜像（`.dockerignore` 已排除）。

生成三个独立密钥并填入 `.env`：

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # FILE_SIGNING_SECRET
openssl rand -base64 48   # PAPER_SIGNING_SECRET
```

### 3.1 核心配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `POSTGRES_USER` | `myos` | 数据库用户 |
| `POSTGRES_PASSWORD` | `myos` | 数据库密码，生产环境必须修改 |
| `POSTGRES_DB` | `myos` | 数据库名 |
| `WEB_HOST` | `0.0.0.0` | Web 监听地址；仅本机访问可改 `127.0.0.1` |
| `WEB_PORT` | `8080` | Web 对外端口 |
| `WEB_URL` | `http://localhost:8080` | 实际访问地址，用于生成链接/校验来源 |
| `CORS_ORIGINS` | `http://localhost:8080` | 允许的跨域来源，多个用逗号分隔 |
| `COOKIE_SECURE` | `false` | 仅 HTTPS 部署时设为 `true` |
| `TRUST_PROXY` | `true` | 位于反向代理之后时保持 `true` |
| `JWT_ACCESS_SECRET` | 占位值 | Access Token 签名密钥，必须替换 |
| `FILE_SIGNING_SECRET` | 占位值 | 历史图片签名 URL 密钥（新上传图片不再持久化），建议替换 |
| `PAPER_SIGNING_SECRET` | 占位值 | 试卷/PDF 链接签名密钥，必须替换 |
| `REGISTRATION_INVITE_CODE` | 空 | 注册邀请码；留空表示开放注册 |
| `AI_PROVIDER` | `mock` | `mock` 为内置模拟；真实识别设为 `openai` |
| `AI_BASE_URL` | `https://api.openai.com/v1` | OpenAI 兼容接口地址，需包含版本路径 |
| `AI_API_KEY` | 空 | AI 服务密钥，只放在 `.env` 中 |
| `AI_MODEL` | `gpt-4o-mini` | 需支持图片输入并返回 JSON |
| `QUEUE_ENABLED` | `false` | `false` 为进程内识别；`true` 使用 Redis + BullMQ |
| `PDF_ENABLED` | `true` | 关闭后 PDF 接口返回 503，打印 HTML 仍可用 |
| `SEED_DEMO` | `false` | 首次启动是否写入演示数据 |
| `TZ` | `Asia/Shanghai` | 容器时区（Compose 中固定设置） |

完整变量及默认值见根目录 `.env.example` 与 `docker-compose.yml`。

### 3.2 生产环境示例

```dotenv
POSTGRES_PASSWORD=<强随机密码>

WEB_HOST=127.0.0.1          # 由宿主机 Nginx/Caddy 反代时只监听本机
WEB_PORT=8080
WEB_URL=https://cuoti.example.com
CORS_ORIGINS=https://cuoti.example.com
COOKIE_SECURE=true
TRUST_PROXY=true

JWT_ACCESS_SECRET=<openssl 生成>
FILE_SIGNING_SECRET=<openssl 生成>
PAPER_SIGNING_SECRET=<openssl 生成>

AI_PROVIDER=openai
AI_API_KEY=<你的密钥>
AI_MODEL=gpt-4o-mini

SEED_DEMO=false
```

注意：

- 不要把真实密钥提交到 Git。
- 前端只请求同源 `/api`，通常无需额外配置 API 地址。
- 非 HTTPS 环境必须保持 `COOKIE_SECURE=false`，否则 Refresh Token Cookie 无法写入。
- 生产模式下 Swagger 不注册；接口文档仅在本地开发时可访问。
- `.env` 中的数据库密码在首次初始化 `pgdata` 卷时生效；之后修改 `.env` 不会自动修改已有数据库密码。

## 4. 构建镜像

```bash
# 校验 Compose 配置
docker compose config --quiet

# 构建 api 和 web
docker compose build
```

首次构建耗时较长：需要拉取基础镜像、安装 pnpm 依赖，并在 API 镜像中下载 Playwright Chromium。构建失败时优先检查网络与 Docker 代理配置。

只构建单个服务：

```bash
docker compose build api
docker compose build web
```

## 5. 启动服务栈

```bash
docker compose up -d
```

或构建并启动一步完成：

```bash
docker compose up -d --build
```

启动顺序由健康检查控制：

1. `postgres` 与 `redis` 启动并通过健康检查；
2. `api` 启动，入口脚本执行 `prisma migrate deploy`；
3. `SEED_DEMO=true` 时执行 `prisma/seed.ts` 写入演示数据；
4. API 通过 `/api/v1/health` 健康检查；
5. `web` 启动 Nginx 并对外提供访问。

首次启动时数据库迁移会自动完成，无需手动执行 `prisma migrate deploy`。

## 6. 验证部署

```bash
# 查看容器状态，api/postgres/redis 应为 healthy
docker compose ps

# 查看 API 启动日志（含迁移结果）
docker compose logs -f api

# 健康检查
curl -fsS http://127.0.0.1:8080/api/v1/health

# 首页
curl -I http://127.0.0.1:8080/
```

访问地址：

- 应用：`http://<服务器IP>:8080`
- API：`http://<服务器IP>:8080/api/v1`
- 健康检查：`http://<服务器IP>:8080/api/v1/health`

若 `SEED_DEMO=true`，演示账号为 `demo` / `demo12345`。

局域网访问：

```bash
hostname -I                 # Linux 查看 IP
sudo ufw allow 8080/tcp     # 如启用了 ufw
```

然后在其他设备打开 `http://<局域网IP>:8080`。HTTP 环境下保持 `COOKIE_SECURE=false`。

## 7. 更新已有部署

```bash
cd myos
git pull
docker compose up -d --build
docker compose ps
```

- 数据库迁移仍由 API 入口脚本自动执行。
- 仅更新某个服务时：

```bash
docker compose build api && docker compose up -d api
docker compose build web && docker compose up -d web
```

- 数据保存在命名卷 `pgdata`、`redisdata`、`storage` 中，重建容器不会丢失。
- 当前镜像使用 `latest` 标签，建议在更新前备份数据库与上传文件。

## 8. 常用运维命令

```bash
docker compose logs -f api          # 跟踪 API 日志
docker compose logs -f web          # 跟踪 Nginx 日志
docker compose restart api          # 重启 API
docker compose stop                 # 停止容器，保留数据
docker compose down                 # 删除容器，保留数据卷
docker compose down -v              # 危险：同时删除数据库、Redis、上传文件卷
```

手动写入演示数据（seed 使用 upsert，可重复执行，但会刷新演示记录）：

```bash
docker compose exec -w /app/apps/api api ./node_modules/.bin/tsx prisma/seed.ts
```

进入 API 容器排查：

```bash
docker compose exec api sh
```

查看数据卷：

```bash
docker volume ls | grep myos
```

## 9. 反向代理与 HTTPS

推荐在宿主机使用 Nginx / Caddy / Traefik 终止 HTTPS，再转发到 `127.0.0.1:8080`。此时建议设置 `WEB_HOST=127.0.0.1`，避免绕过代理直接访问。

Nginx 示例：

```nginx
server {
    listen 443 ssl http2;
    server_name cuoti.example.com;

    ssl_certificate     /etc/letsencrypt/live/cuoti.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cuoti.example.com/privkey.pem;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
```

Caddy 示例：

```caddyfile
cuoti.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

同时更新 `.env`：

```dotenv
WEB_HOST=127.0.0.1
WEB_URL=https://cuoti.example.com
CORS_ORIGINS=https://cuoti.example.com
COOKIE_SECURE=true
TRUST_PROXY=true
```

修改后执行 `docker compose up -d` 使配置生效。

## 10. 备份与恢复

以下命令假设项目目录名为 `myos`（Compose 项目名即 `myos`），数据库用户为 `myos`。可通过 `docker volume ls | grep myos` 确认实际卷名，按需替换。

备份数据库：

```bash
docker compose exec -T postgres pg_dump -U myos myos > backup.sql
```

备份上传文件卷：

```bash
docker run --rm -v myos_storage:/data -v "$PWD":/backup alpine \
  tar czf /backup/storage.tar.gz -C /data .
```

恢复数据库：

```bash
cat backup.sql | docker compose exec -T postgres psql -U myos myos
```

恢复文件卷：

```bash
docker run --rm -v myos_storage:/data -v "$PWD":/backup alpine \
  sh -c "cd /data && tar xzf /backup/storage.tar.gz"
```

建议定期备份 `pgdata` 与 `storage`（试卷 PDF）。上传图片仅写入系统临时目录，识别完成后自动清理，无需备份。

## 11. 常见问题

| 现象 | 排查方向 |
| --- | --- |
| `docker compose` 命令不存在 | 安装 Docker Compose v2 插件，使用 `docker compose` 而非旧版 `docker-compose` |
| 8080 端口被占用 | 修改 `.env` 中 `WEB_PORT`，再执行 `docker compose up -d` |
| API 反复重启 | `docker compose logs api`；常见原因是数据库未就绪、`DATABASE_URL` 错误或迁移失败 |
| 数据库密码修改后连不上 | 密码只在初始化卷时生效；需进入 Postgres 修改密码或重建卷（会丢数据） |
| 局域网无法访问 | 确认 `WEB_HOST=0.0.0.0`、防火墙放行端口、Docker 允许传入连接 |
| 登录后立即掉线 | HTTP 环境下应设置 `COOKIE_SECURE=false` |
| PDF 接口返回 503 | 确认 `PDF_ENABLED=true`；查看 API 日志中 Chromium 启动错误 |
| 构建卡在 Playwright 下载 | 为 Docker 配置 HTTP/HTTPS 代理，或更换可访问的浏览器下载源 |
| 前端接口 502 | API 未通过健康检查；先修复 API，再执行 `docker compose restart web` |
| 上传大图失败 | 默认限制 100 MB（`apps/web/nginx.conf` 的 `client_max_body_size`） |

查看 API 健康状态与详细错误：

```bash
docker compose ps
docker inspect --format '{{json .State.Health}}' myos-api-1
docker compose logs --tail=200 api
```

## 12. 停止与彻底清理

```bash
# 停止并删除容器，保留数据
docker compose down

# 删除容器和所有数据卷（不可恢复）
docker compose down -v

# 删除本项目镜像
docker image rm myos-api myos-web
```

> `docker compose down -v` 会删除数据库、Redis 数据和试卷 PDF，仅应在确认不再需要数据时使用。

## 13. 安全清单

- [ ] 修改 `POSTGRES_PASSWORD`、`JWT_ACCESS_SECRET`、`FILE_SIGNING_SECRET`、`PAPER_SIGNING_SECRET`
- [ ] 生产环境启用 HTTPS，并设置 `COOKIE_SECURE=true`
- [ ] 通过 `REGISTRATION_INVITE_CODE` 限制注册
- [ ] 不把 `.env`、AI Key、备份文件提交到 Git
- [ ] 定期备份 `pgdata` 与 `storage`（试卷 PDF）
- [ ] 只暴露必要端口，数据库与 Redis 不对公网开放
- [ ] 反向代理后设置 `WEB_HOST=127.0.0.1`

## 14. 与本地开发的区别

| 项目 | 容器部署 | 本地开发 |
| --- | --- | --- |
| 启动命令 | `docker compose up -d` | `pnpm dev` |
| 环境变量 | 根目录 `.env` | `apps/api/.env` |
| 数据库 | Compose 内置 PostgreSQL | 宿主机 PostgreSQL |
| 端口 | Web `8080` | Web `5173`、API `3000` |
| 数据库迁移 | 容器启动时自动执行 | `pnpm db:deploy` / `pnpm db:migrate` |
| Swagger | 生产模式关闭 | `http://localhost:3000/api/docs` |
| Chromium | 镜像内置 | 需手动 `playwright install chromium` |

本地开发、测试与构建命令详见 [README.md](./README.md)。
