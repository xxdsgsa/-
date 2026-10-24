# FitMate Agent Skills

项目级 Cursor Agent Skills。**两种触发模式并存:**

- **自建 3 个**(下表上半部分):`disable-model-invocation: true` —— AI 不会自动 invoke,只在被显式调用时生效。
- **社区 5 个**(下表下半部分):保留上游原生 `description`,**允许 AI 自动 invoke**。装这些 skill 是为了在对话中自动捕获意图,而不是每次都要点名。

---

## 自建 skill(仅手动触发)

| Skill | 何时手动触发 | 触发后 AI 做什么 |
|---|---|---|
| `fix-bug` | "报 bug / 报错 / 测试挂了 / 排查错误" | 走 5 步:复现 → 定位 → 根因 → 修复 → 验证,最后输出 Bug fix report |
| `tdd-red` | "加新功能 / 写新规则 / 写新查询" (在写实现前) | 写**失败**单测,跑通确认 red,交付给 green 阶段;不在此 skill 写实现 |
| `verify-build` | "跑一下 / 验证 / commit 前" | 顺序跑 typecheck → lint → test → build,出绿/红报告表 |
| `parallel-review` | "审查这个改动 / 帮我全面检查 / 这个能合吗" | 4 个只读 subagent 并行审查,置信度 ≥80 过滤后汇总 |

### 怎么手动触发

在 Cursor 里**直接叫出名字**就行,任选其一:

```
"用 fix-bug 排查一下:登录页点了没反应"
"用 tdd-red 写一个 isFutureDate 的测试"
"用 verify-build 跑一遍"
"用 parallel-review 审一下这个改动"
```

或更自然:

```
"修一下这个 bug,用 fix-bug 流程"
"按 tdd-red 写测试"
"verify-build 看看能不能合"
```

---

## 社区 skill(自动触发)

装自 SkillsMP。**均已适配为 FitMate 版本**,上游专有内容(Warp 署名、云端 agent、Figma MCP、自动装依赖)已剥离。

| Skill | 来源 | 何时自动触发 | 作用 |
|---|---|---|---|
| `half-fixed` | [heyzainali/half-fixed](https://github.com/heyzainali/half-fixed)(MIT) | 刚修完一个 query / schema,想知道有没有同类文件没跟上 | 扫 git 历史找「只修了一半的兄弟实现」,分诊后逐个补 |
| `validate-changes-match-specs` | [warpdotdev/common-skills](https://github.com/warpdotdev/common-skills) | review 或收尾一个 spec 驱动的改动 | 实现 vs `docs/PRD.md` / `docs/TECH.md` / `AGENTS.md` 逐条比对 |
| `merge-risk` | [warpdotdev/common-skills](https://github.com/warpdotdev/common-skills) | 问「这个能合吗」 | 五维评分:alignment / impact / verification / rollback / error-detection |
| `next-dev-loop` | [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills/next-dev-loop) | 改完 Next.js app 代码,想确认真跑起来是对的 | /_next/mcp + agent-browser 双视角验证运行期行为 |
| `next-bundle-optimizer` | [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills/next-bundle-optimizer) | 首屏慢 / 客户端包过大 | next analyze 构建证据驱动的负载审计与优化 |

**最常自动触发的是 `half-fixed`** —— 它正好对应 AGENTS.md 第一条数据规则(user_id 条件必须全覆盖)。Agent 改完一个 `lib/db/queries/*.ts` 后,这个 skill 会问你要不要查一遍同类文件。

---

## ✅ 已满足的前置条件

`next-dev-loop` 的两条前置条件现在都已就位:

| 依赖 | 要求 | 本机实际 | 状态 |
|---|---|---|---|
| Next.js | `>= 16.3` + Turbopack | `16.3.8`(默认 Turbopack) | ✅ |
| `agent-browser` | `>= 0.31.1` | `0.39.2` 全局 | ✅ |
| Chrome 二进制 | 随 agent-browser 安装 | `156.0.8078.47`(`~/.agent-browser/browsers/`) | ✅ |

装法:`npm i -g agent-browser@latest` + `agent-browser install`(2026-10-23 执行)。其余 4 个 skill 零额外依赖(`half-fixed` 自带零依赖扫描器)。

⚠️ **唯一遗留告警**:安装时报 `EBADENGINE`,`agent-browser@0.39.2` 要求 `node >= 24.0.0`,本机 nvm4w 当前 `20.20.2`。实测功能正常,可用;若日后 agent-browser 侧出现异常,先用 `nvm install 24 && nvm use 24` 试。Next.js 16.3.8 本身支持 Node 20,不影响 `pnpm dev / build / test`。

`half-fixed` 在 Windows 下会打印一条 `MODULE_TYPELESS_PACKAGE_JSON` 警告(Node 缺 `"type": "module"` 时重解析 ESM)。不影响功能,忽略即可 —— 不要为此改项目 `package.json`。

---

## 工作流(典型一天)

```
1. 写新功能
   ├─ "按 tdd-red 写测试"          ← 写一个失败测试
   ├─ 写实现代码(普通对话)
   ├─ 自动:"这次改动有没有漏改同类文件?"  ← half-fixed
   └─ "verify-build 跑一遍"        ← 全套验证

2. 改 bug
   ├─ "用 fix-bug 排查"            ← 5 步流程
   ├─ 自动:half-fixed 查同类漏网
   └─ "verify-build 跑一遍"        ← 验证没回归

3. 准备 commit
   ├─ "这个能合吗?"                ← merge-risk
   ├─ "verify-build 跑一遍"        ← 全绿再 commit
   └─ "实现和 spec 对得上吗?"      ← validate-changes-match-specs

4. Next.js 专项
   ├─ "改完真的跑起来对吗?"        ← next-dev-loop
   └─ "首屏是不是太重?"            ← next-bundle-optimizer
```

---

## 约束(从 AGENTS.md 继承)

所有 skill **强制遵守**项目根的 `AGENTS.md` 规则,核心:

- 业务逻辑只放 `lib/<domain>/<rule>.ts` 纯函数
- 数据访问只走 `lib/db/queries/`
- 所有用户数据查询必须带 `user_id` 条件
- 禁止 `any`、`@ts-ignore`、无理由 `eslint-disable`
- 一次一个独立功能 commit
- 不改 `.env`、不修改已有 Drizzle migration(只新增)

---

## 文件结构

```
.cursor/skills/
├── README.md                        ← 本文件
├── fix-bug/SKILL.md                 ┐
├── tdd-red/SKILL.md                 ├ 自建,仅手动
├── verify-build/SKILL.md            │
├── parallel-review/SKILL.md         ┘ 自建,仅手动
├── half-fixed/                      ┐
│   ├── SKILL.md                     │
│   ├── scripts/half-fixed.js        │ 社区,自动触发
│   └── references/{triage,fixing}.md│
├── validate-changes-match-specs/SKILL.md      ┘
├── merge-risk/SKILL.md
├── next-dev-loop/SKILL.md
└── next-bundle-optimizer/
    ├── SKILL.md
    └── references/{graph-methods,fix-patterns}.md

.claude/agents/                      ← 只读审查 subagent(Cursor + Claude Code 通用)
├── compliance-reviewer.md           ← 分层红线 / user_id / localStorage / 迁移
├── type-boundary-reviewer.md        ← Zod 一致性 / any / 可空性 / 校验边界
├── error-handling-reviewer.md       ← 静默失败 / fallback / 错误码
└── test-coverage-reviewer.md        ← 覆盖缺口 / 测试质量
```

**为什么 subagent 放 `.claude/agents/`**:Cursor 官方支持该目录(与 `.cursor/agents/`、`.codex/agents/` 并列),且 Claude Code 能直接复用同一份定义。四个 agent 全部设 `readonly: true`——Cursor 并行 Task 的多个 subagent 无文件锁,并行写会 race condition,所以并行阶段只读,写操作由主 agent 串行做。

---

## 维护规则

- **新增 skill**:在 `AGENTS.md` 里加一条 ADR 解释为什么需要,再写 SKILL.md,然后一个 commit
- **改 skill**:同样一个 commit,message 前缀 `chore(skills):`
- **删 skill**:先看 git log 决定是不是有人还在用,然后一个 commit
- **升级社区 skill**:重新读上游 SKILL.md,只 diff 出上游改动,**重新套用本文件的适配段落**再落盘

## 没装的 & 为什么

| 候选 | 不装的原因 |
|---|---|
| `commit-msg` (写 commit 信息) | 你已经用 `git commit -m "..."` 手写,前置不够痛 |
| `pr-review` | 本仓库目前单人开发,`merge-risk` 已覆盖合并前视角 |
| `e2e` 跑 Playwright 的 skill | 慢且易 flakiness,`pnpm test:e2e` 已够用 |
| `adr-author` (写 ADR) | docs/ 下 ADR 都是人写的判断,AI 写会丢上下文 |
| `next-cache-components-adoption` | 属重量级框架迁移,应单独立项,不宜作为常驻 skill |
| `diagnose-ci-failures` / `pr-status-triage` | 硬编码各自仓库的脚本(warp 的 Rust/WASM、next.js 的 `scripts/pr-status.js`),本仓库不存在,需大幅重写 |
| Cloudflare `security-audit` | Cursor 自带 `security-review` subagent 已覆盖 |
| 各类 CI runner / 定价 / 内容 / 3D / 加密类 skill | 与本项目无关 |

## Claude Code 插件库评估(2026-10)

参考 [anthropics/claude-code/plugins](https://github.com/anthropics/claude-code/tree/main/plugins) 的官方插件,逐个评估后的结论:

| 插件 | 结论 | 理由 |
|---|---|---|
| `pr-review-toolkit` | **已吸收** | 其 6 个 agent 的**审查维度**已重写进 `.claude/agents/` 的 4 个只读 agent(按 FitMate 红线重新切分维度,非逐个照搬) |
| `code-review` | **已吸收** | 核心是「置信度评分 + 80 阈值过滤」,已落进 `parallel-review` skill 的 Phase 2 |
| `security-guidance` | **部分吸收** | 9 种危险模式清单与 Cursor 自带 `security-review` subagent 重叠,不再重复装 |
| `commit-commands` | 不装 | AGENTS.md 已规定「每完成一个独立功能即 git commit」,增益低 |
| `feature-dev` | 不装 | 与已有 `tdd-red` + `fix-bug` 重叠 |
| `frontend-design` | 不装 | 项目已有 shadcn + Tailwind 统一视觉,换风格会破坏一致性 |
| `ralph-wiggum` | 不装 | 无人值守自改代码,与「高质量输出」目标相悖 |
| `hookify` / `plugin-dev` / `agent-sdk-dev` / `claude-opus-4-5-migration` / 各种 output-style | 不装 | 元开发工具、不相关、或 Cursor 已自带 |

**移植时做的关键适配**(详见 AGENTS.md ADR-24 ~ ADR-27):

- 上游 `silent-failure-hunter` 假设项目有 `logError` / `errorIds.ts` / Statsig,并把「无日志的 catch」一律判为缺陷。FitMate 的 `.catch(() => null)` 是**刻意设计**(把预期失败翻译成 401/400 而非 500),直接套用会大规模误报——故 `error-handling-reviewer` 重写了判定基准。
- 上游 `code-review` 依赖 `gh` CLI 与 PR 流程,本项目单人开发直推 `main`,故只吸收方法论,不移植命令。
- Cursor 的 subagent frontmatter 比 Claude Code 多一个 `readonly` 字段,四个 agent 全部启用。
