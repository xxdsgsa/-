# FitMate — 你的健身伙伴

训练计划、饮食记录、数据统计,一站式健身助手。

<!-- 截图占位:V1 上线后替换 -->
![FitMate 截图](docs/screenshot-placeholder.png)

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript strict |
| 样式 | Tailwind CSS + shadcn/ui |
| 数据库 | PostgreSQL (Neon Serverless) |
| ORM | Drizzle ORM |
| 认证 | Better Auth (HttpOnly Cookie) |
| 表单校验 | Zod v4 |
| 邮件 | Resend (emailOTP 验证码) |

详见 [docs/TECH.md](docs/TECH.md)。

---

## 环境变量

复制 `.env.example` → `.env`,填入真实值。

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL 连接串 |
| `BETTER_AUTH_SECRET` | ✅ | 会话密钥;`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成 |
| `BETTER_AUTH_URL` | ✅ | 站点 URL,生产填 Vercel 域名 |
| `RESEND_API_KEY` | 🔶 推荐 | 注册/找回/注销邮件发送(当前开发期 console 输出) |
| `EMAIL_FROM` | 🔶 推荐 | 发件人地址,默认 `FitMate <onboarding@resend.dev>` |
| `SENTRY_DSN` | 🔶 上线前 | 生产错误上报;不填则 Sentry 降级 noop |

> `.env` 已被 `.gitignore` 排除,**严禁提交**。

---

## 本地开发

```bash
# 安装依赖
pnpm install

# 数据库迁移(首次启动 / schema 变更后)
pnpm db:migrate

# 启动开发服务器(Turbopack)
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)。

---

## 测试

```bash
# 单元测试
pnpm test

# 端到端测试(首次运行安装浏览器)
pnpm test:e2e:install
pnpm test:e2e
```

---

## 部署

### 开发/验证: Vercel

```bash
# vercel 登录后直接推送 main 分支即可
git push origin main
```

### 生产: 腾讯云 EdgeOne Pages

> ⚠️ 待 ADR-9 Next.js 兼容性验证通过后启用。

部署前确认项:
- [ ] `BETTER_AUTH_URL` 填入 EdgeOne 分配的域名
- [ ] `DATABASE_URL` 连接串指向 Neon 生产数据库
- [ ] `SENTRY_DSN` 已配置
- [ ] `RESEND_API_KEY` 已配置且域名已验证

---

## 上线 Checklist

上线前逐项确认:

- [x] **1. 错误兜底** — `error.tsx` / `global-error.tsx` / `not-found.tsx` 已部署 (`a7640a0`)
- [x] **2. 全局鉴权** — `middleware.ts` Edge 鉴权 + 已登录用户守卫 (`4c69a7c`)
- [x] **3. SEO 基础** — `sitemap.ts` / `robots.ts` / `layout` metadata 已完善
- [x] **4. 安全 headers** — `next.config.ts` 已配置 X-Frame-Options / HSTS 等
- [x] **5. PWA 支持** — `manifest.webmanifest` / `theme-color` / 占位图标已部署
- [ ] **6. Sentry 接入** — 需人工确认 `@sentry/nextjs` 安装后启用
- [ ] **7. 上线文档** — README / 环境变量清单已完善

---

## ADR 决策索引

| ADR | 标题 | 状态 |
|---|---|---|
| ADR-1 | 平台形态(移动端 Web App → Capacitor V2) | 冻结 |
| ADR-6 | 认证方案(Better Auth,HttpOnly Cookie) | 冻结 |
| ADR-9 | 部署策略(Vercel dev / EdgeOne production) | 待验证 |
| ADR-16 | 日志与可观测性(Sentry) | 待接入 |
| ADR-17 | 环境变量管理 | 冻结 |

详见 [docs/TECH.md](docs/TECH.md)。
