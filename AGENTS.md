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

## Agent Skills

自建 skill 位于 `.cursor/skills/`,说明见 [.cursor/skills/README.md](.cursor/skills/README.md)。
新增/修改 skill 需在本文件补一条 ADR 说明原因。

| Skill | 来源 | 触发方式 | 用途 |
|---|---|---|---|
| `fix-bug` | 自建 | 仅手动 | 5 步排查:复现→定位→根因→修复→验证 |
| `tdd-red` | 自建 | 仅手动 | 写失败测试(red 阶段) |
| `verify-build` | 自建 | 仅手动 | typecheck→lint→test→build 全套 |
| `half-fixed` | heyzainali/half-fixed (MIT) | 自动 | 扫 git 历史找出「只修了一半的同类实现」 |
| `validate-changes-match-specs` | warpdotdev/common-skills | 自动 | 实现 vs `docs/PRD.md`/`docs/TECH.md`/`AGENTS.md` 一致性 |
| `merge-risk` | warpdotdev/common-skills | 自动 | PR 五维合并风险评分 |
| `next-dev-loop` | vercel/next.js | 自动 | 改完代码在运行中的 app 里验证行为 |
| `next-bundle-optimizer` | vercel/next.js | 自动 | 首屏客户端负载审计与优化 |
| `parallel-review` | 自建 | 仅手动 | 4 个只读 subagent 并行审查 + 置信度 ≥80 过滤 |

## Agent Subagents

只读审查 subagent 位于 `.claude/agents/`(Cursor 与 Claude Code 通用),均设 `readonly: true`——只读分析,不改文件。

| Subagent | 关注维度 | 明确不碰 |
|---|---|---|
| `compliance-reviewer` | 分层红线 / `user_id` 越权 / localStorage 白名单 / 禁 `any` / 迁移不可改 | 类型细节、测试充分性 |
| `type-boundary-reviewer` | Zod 与 TS 类型一致性 / `any` 泄漏 / 可空性 / 校验边界 | 业务逻辑、分层 |
| `error-handling-reviewer` | 静默失败 / fallback 掩盖 / 错误码一致性 | 类型、分层、测试 |
| `test-coverage-reviewer` | 覆盖缺口 / 边界负例 / 测试质量 | 实现正确性、类型 |

- ADR-24:引入只读审查 subagent(`.claude/agents/`),因为 `AGENTS.md` 的硬规则(user_id 越权、分层越界、敏感数据落 localStorage、禁 `any`)目前只能靠人工或单一 reviewer 发现,而这些规则一旦违反就是安全事故或数据越权。选 `.claude/agents/` 而非 `.cursor/agents/`,因为 Cursor 官方支持该目录且与 Claude Code 共用同一份定义;四个 agent 按维度正交切分,避免重复劳动。
- ADR-25:四个 subagent 全部设 `readonly: true`,因为 Cursor 并行 Task 的多个 subagent 无文件锁,并行写同一文件会 race condition。结构性限制写权限比靠提示词约束更可靠:并行只做只读分析,写操作一律由主 agent 串行执行。
- ADR-26:审查结论按置信度 ≥80 过滤(借鉴 Claude Code `code-review` 插件的评分机制),因为多 agent 并行产出的低置信度发现会淹没真实问题,导致主 agent 宁可全不改。阈值可按用户要求调整(多报 75 / 确凿 90)。
- ADR-27:`error-handling-reviewer` 明确把 `src/lib/api/auth.ts` / `src/lib/api/parse.ts` / `src/lib/hooks/use-draft.ts` 中的 `.catch(() => null)` 判定为刻意设计(把预期失败翻译成 401/400 而非 500),因为上游同类 agent 会将其一律判为静默失败,在本项目会大规模误报。ADR-16 规定 Sentry 上线前才接入,故「缺少 error ID / Sentry 上报」当前不作为缺陷。

- ADR-18:采用 `half-fixed`,因为「所有用户数据查询必须带 user_id」这类规则天然要求同类 query 同步修改,人工容易漏。扫描 git 历史找出只改了一半的兄弟文件,正好覆盖这个风险。
- ADR-19:采用 `validate-changes-match-specs`,因为本仓库已有 PRD + TECH + 17 条 ADR 的规格体系,但缺少「实现是否兑现规格」的机械化检查。已适配为读取 `docs/` 布局,并把 AGENTS.md 硬规则纳入 mismatch 判定。
- ADR-20:采用 `merge-risk`,因为 AGENTS.md 要求高频小 commit,需要一个轻量的合并前风险视角。已适配为按 FitMate 的敏感面(user_id 越权 / localStorage / migration 不可改)收紧判定,并去掉 AI 署名 trailer。
- ADR-21:采用 `next-dev-loop`,因为 AGENTS.md 顶部已声明「This is NOT the Next.js you know」,而本仓库用 Next 16.3.8。官方 skill 用 /_next/mcp + agent-browser 双视角验证运行期行为,补上 typecheck/build 之外的第三种验证。**注意:依赖 agent-browser(需全局 npm 安装),当前环境未安装,启用前需人工确认。**
- ADR-22:采用 `next-bundle-optimizer`,因为健身 App 首屏含图表与训练数据,客户端负载是真实风险。官方 skill 用 next analyze 的构建证据驱动优化。已去掉对未安装的 cache-components 相关 skill 的自动安装依赖。
- ADR-23:CI 补 typecheck 与 build 两步。原先 CI 只跑 lint + 单测,与 verify-build 的四步不一致;对以「禁 any + TS strict」为首要原则的项目,CI 缺类型检查等于形同虚设。build 步骤用无凭据占位 env(构建期只需模块加载通过)。
