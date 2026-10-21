# 错题本 · 家庭 AI 学习助手

一款面向家庭的移动端 H5 错题本应用：拍照上传错题，调用视觉 AI 识别题目、答案与知识点，按孩子/年级/学科归档；并可从错题中筛选题目，一键生成 A4 打印试卷（含答案页）。

前后端分离，支持本地 Docker Compose 部署，也支持不使用 Docker 的本地开发模式。

## 界面预览

| 首页 | 错题本 | 知识点 | 录入错题 |
| --- | --- | --- | --- |
| <img src="docs/screenshots/home.png" width="180" /> | <img src="docs/screenshots/questions.png" width="180" /> | <img src="docs/screenshots/knowledge.png" width="180" /> | <img src="docs/screenshots/upload.png" width="180" /> |

| 错题组卷 | 试卷详情 | 我的 | 登录 |
| --- | --- | --- | --- |
| <img src="docs/screenshots/papers.png" width="180" /> | <img src="docs/screenshots/paper-detail.png" width="180" /> | <img src="docs/screenshots/profile.png" width="180" /> | <img src="docs/screenshots/login.png" width="180" /> |

## 功能

- **拍照 / 图片识别**：一次最多 9 张，AI 自动识别题干、选项、正确答案、孩子原答案、解析、错因、知识点和难度。
- **双模式录题**：录题页可随时切换 AI 拍照识别与手动录入；手动模式支持完整填写题干、选项、答案、解析、知识点、难度和掌握度。
- **识别结果确认**：保存前可逐题修正，支持只保存错题、批量全选、手动补录。
- **多孩子档案**：一个家庭账号管理多个孩子，按年级和学期归档；年级切换后自动匹配可用学科。
- **错题本**：按学科、题型、掌握度、知识点、关键词筛选；批量归档/删除；批量加入组卷。
- **掌握度管理**：每道错题可标记 0–5 掌握度，用于筛选、薄弱知识点分析和组卷抽题。
- **知识点**：AI 自动沉淀学科知识点标签；支持手动新增、重命名、合并重复标签；按薄弱指数排序展示。
- **统计概览**：错题总数、已掌握、近 7 天新增、学科分布、录入趋势、薄弱知识点。
- **错题组卷**：按学科、掌握度筛选，或从错题本勾选题目；支持随机抽题、标题与答案页设置。
- **打印 / PDF**：服务端 Chromium 生成 A4 PDF；题目按选择题、判断题、填空题、解答题自动分组编号，答案与解析单独成页。
- **账号安全**：账号密码注册登录；短期 Access Token + httpOnly Refresh Token 轮换；接口限流；图片私有存储、签名 URL 访问。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、TypeScript、Vant 4、Pinia、Vue Router、Axios、KaTeX |
| 后端 | NestJS 11、Prisma 6、PostgreSQL、Passport JWT、class-validator、Swagger |
| AI | OpenAI 兼容 Chat Completions 视觉接口，内置 mock provider |
| 异步任务 | 默认进程内执行；可选 Redis + BullMQ |
| 文件 | 本地磁盘或 MinIO / S3 兼容存储；图片签名 URL |
| PDF | Playwright + Chromium |
| 部署 | Docker Compose、Nginx |

## 目录结构

```
apps/
  api/                 NestJS API
    prisma/            schema、迁移、seed
    src/
      ai/              AI Provider、任务、队列
      auth/            登录、注册、刷新令牌
      common/          守卫、Prisma、异常过滤器、日期工具
      knowledge-points/知识点
      papers/          组卷、打印 HTML、PDF
      stats/           首页与知识点统计
      students/        孩子档案
      subjects/        学科
      uploads/         上传、图片处理、存储
      wrong-questions/ 错题 CRUD / 批量
  web/                 Vue 3 H5
    src/
      api/             接口封装
      components/      布局、题目卡片、富文本等
      stores/          auth / student / paperSelection
      views/           页面
packages/
  shared/              前后端共享常量、类型、AI zod schema
```

## 快速开始（本地开发）

### 1. 环境要求

- Node.js >= 22.12
- pnpm >= 10
- PostgreSQL >= 14
- 可选：Chromium（生成 PDF 需要）

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置数据库与环境变量

创建数据库（示例）：

```bash
createdb myos
# 或使用已有 PostgreSQL，并准备一个可读写用户
```

复制环境变量：

```bash
cp apps/api/.env.example apps/api/.env
```

编辑 `apps/api/.env`，至少确认：

```dotenv
DATABASE_URL=postgresql://myos:myos@localhost:5432/myos?schema=public
AI_PROVIDER=mock
QUEUE_ENABLED=false
STORAGE_DRIVER=local
PDF_ENABLED=true
```

### 4. 初始化数据库并写入演示数据

```bash
pnpm db:deploy
pnpm db:seed
```

演示账号：`demo` / `demo12345`，包含两个孩子和若干示例错题。

### 5. 安装 Chromium（PDF 需要）

```bash
pnpm --filter @myos/api exec playwright install chromium
```

如果不需要 PDF，可设置 `PDF_ENABLED=false`，打印 HTML 页面仍可使用。

### 6. 启动

```bash
pnpm dev
```

- H5：<http://localhost:5173>
- API：<http://localhost:3000/api/v1>
- Swagger：<http://localhost:3000/api/docs>
- 健康检查：<http://localhost:3000/api/v1/health>

也可以分别启动：

```bash
pnpm dev:api
pnpm dev:web
```

## Docker Compose 部署

```bash
cp .env.example .env
# 修改数据库密码、JWT / 文件 / 试卷签名密钥
docker compose up -d --build
```

访问 `http://服务器IP:8080`。

### 局域网访问

Compose 默认把 Web 端口绑定到 `0.0.0.0`，同一局域网的手机/电脑可直接访问。先查看运行 Docker 的机器 IP：

```bash
# macOS
ipconfig getifaddr en0
# Linux
hostname -I
```

然后在其他设备打开 `http://<局域网IP>:8080`。如果无法访问，请检查：

- `.env` 中 `WEB_HOST=0.0.0.0`（默认值）
- Linux 防火墙放行端口：`sudo ufw allow 8080/tcp`
- macOS 首次运行时允许 Docker 接受传入连接
- 使用 HTTP 时保持 `COOKIE_SECURE=false`，只有 HTTPS 才改为 `true`

前端请求走同源 `/api`，通常不需要额外配置。若确有跨域直连 API 的需求，再把 `WEB_URL`、`CORS_ORIGINS` 改成 `http://<局域网IP>:8080`。

首次启动自动执行 `prisma migrate deploy`。如需演示数据：

```bash
# 在 .env 中设置 SEED_DEMO=true 后重新启动，或手动执行：
docker compose exec -w /app/apps/api api ./node_modules/.bin/tsx prisma/seed.ts
```

常用命令：

```bash
docker compose logs -f api
docker compose ps
docker compose down
docker compose down -v   # 谨慎：会删除数据库和文件卷
```

### 反向代理与 HTTPS

默认 Compose 暴露 8080 端口。生产环境建议在宿主机使用 Caddy / Nginx / Traefik 终止 HTTPS，并转发到 `127.0.0.1:8080`。同时修改 `.env`：

```dotenv
WEB_URL=https://your-domain.example.com
CORS_ORIGINS=https://your-domain.example.com
COOKIE_SECURE=true
TRUST_PROXY=true
```

前端只调用同源 `/api`，无需额外配置 API 地址。

## 配置 AI 识别

应用支持任意 OpenAI 兼容的视觉模型接口。把 `AI_PROVIDER` 改为 `openai`，填写：

```dotenv
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
AI_JSON_MODE=true
```

说明：

- `AI_BASE_URL` 需包含版本路径（通常以 `/v1` 结尾）。
- 模型必须支持图片输入（vision），并能返回 JSON 内容。
- `AI_JSON_MODE=true` 时会请求 `response_format: json_object`；部分兼容服务不支持，可改为 `false`。
- `AI_TIMEOUT_MS` 默认 120 秒；`AI_MAX_RETRIES` 控制单张图片重试次数。
- `AI_DAILY_JOB_LIMIT` 控制每个账号每日识别任务数。
- 图片会压缩到最长边 1600px 后以 base64 发送给模型；应用不会把图片上传到除你配置的 AI 服务之外的第三方。
- **不要**把真实 Key 写入聊天、代码或 Git；只放在 `.env` 或部署平台密钥管理中。

先用 `AI_PROVIDER=mock` 可以完整体验上传、识别确认、保存和组卷流程。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | 注册（可同时创建孩子档案） |
| POST | `/api/v1/auth/login` | 登录，Refresh Token 写入 httpOnly Cookie |
| POST | `/api/v1/auth/refresh` | 刷新 Access Token |
| GET | `/api/v1/students` | 孩子列表 |
| POST | `/api/v1/uploads` | 上传图片（multipart，字段 `files`） |
| POST | `/api/v1/ai/jobs` | 创建识别任务 |
| GET | `/api/v1/ai/jobs/:id` | 查询识别进度与结果 |
| POST | `/api/v1/wrong-questions/batch` | 批量保存识别结果 |
| GET | `/api/v1/wrong-questions` | 错题列表/筛选 |
| GET | `/api/v1/stats/overview` | 首页统计 |
| GET | `/api/v1/stats/knowledge` | 薄弱知识点 |
| POST | `/api/v1/papers/candidates` | 组卷候选题目 |
| POST | `/api/v1/papers` | 生成试卷（保存题目快照） |
| GET | `/api/v1/papers/:id/print-token` | 获取打印/PDF 短期签名链接 |
| GET | `/api/v1/papers/:id/pdf?token=...` | 下载 PDF |

完整参数与响应可在 Swagger 中查看。

## 安全与隐私

- 图片存储在私有目录/桶中，通过带 HMAC 签名和有效期的 URL 访问，不暴露真实路径。
- Refresh Token 只放在 httpOnly Cookie 中，服务端保存 SHA-256 哈希并轮换；Access Token 仅保存在前端内存。
- 注册支持可选的邀请码；接口有全局限流和登录/识别专项限流。
- PDF / 打印链接使用独立签名令牌，默认 15 分钟过期。
- 数据均在你自己部署的服务器和数据库中；请自行做好数据库、`storage` 卷备份。
- 建议在生产环境修改所有默认密钥，并启用 HTTPS。

备份示例：

```bash
docker compose exec -T postgres pg_dump -U myos myos > backup.sql
docker run --rm -v myos_storage:/data -v "$PWD":/backup alpine tar czf /backup/storage.tar.gz -C /data .
```

## 测试与构建

```bash
pnpm typecheck
pnpm test
pnpm build
```

单独检查：

```bash
pnpm --filter @myos/api typecheck
pnpm --filter @myos/web typecheck
pnpm --filter @myos/api test
```

## 已知限制

- 组卷用于打印/PDF 练习，不提供在线作答和自动判分。
- PDF 依赖 Chromium；未安装时接口会返回 `503` 并提示。
- AI 识别质量取决于图片清晰度和所选模型；保存前必须人工确认。
- 当前版本面向单家庭/小规模自托管，未实现多租户隔离和对象存储生命周期策略。

## License

仅供个人与家庭学习使用。
