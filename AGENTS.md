<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FitMate 项目规则

依据:docs/TECH.md(技术文档 v1.0.1)附录 C + 17 条 ADR;docs/PRD.md(产品需求 v1.6)。

- 技术栈:Next.js(App Router)+ TS strict + Tailwind + shadcn/ui + Drizzle + Better Auth + Zod
- 包管理只用 pnpm;禁止安装新依赖(需人工确认)
- 禁 any;组件用函数式;严格模式
- 禁止改动 .env / 数据库迁移文件(迁移只新增不修改)
- 所有用户数据查询必须带 user_id 条件
- 业务逻辑禁止写在页面/API 层:数据访问走 lib/db/queries,业务规则走 lib 纯函数
- Session 走 HttpOnly Cookie;Token/Session/用户信息严禁写入 localStorage(白名单:仅表单草稿)
- 每完成一个独立功能即 git commit
- 常用命令:pnpm dev / pnpm build / pnpm test / pnpm db:generate / pnpm db:migrate
