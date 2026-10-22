---
name: merge-risk
description: Use when assessing the risk of merging a PR, or when the user asks "is this safe to merge", "what's the merge risk", or wants a pre-merge review of a branch or pull request in FitMate.
metadata:
  credits:
    skill: pr
    author: Matt Pocock
    url: https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md
---

# Merge Risk (FitMate)

Output format:

```
**Merge risk:** **<level>**
- <...list all categories>
```

These are the **categories** and **verdicts** that affect risk, with descriptions of what "low risk" means:

- **Alignment (poor ⚠️ / decent 👀 / good ✅):** Code aligns with the description and source issue, when present. Behavior assumptions and drive-bys must be documented.
- **Impact (large ⚠️ / medium 👀 / small ✅):** Scope is contained and away from sensitive code paths.
  - Consider blast radius: potential impact or scope of the changes introduced by this PR. Consider all possibilities. Examples are layout shift, breakages for consumers, mobile responsiveness, etc.
  - Sensitive areas carry outsized risk regardless of diff size: auth, permissions, payments, PII, secrets, data migrations, dependency bumps, and infra or config changes. Flag any that are touched, and call out anything that widens access, weakens validation, or logs sensitive data.
- **Verification (poor ⚠️ / decent 👀 / good ✅):** Behavior is verified, where applicable.
  - Changes to the user experience **need** end-to-end proof as screenshots or recordings. Changes that could meaningfully affect performance **need** profiling. Prefer before-and-after evidence to standalone proof. When this coverage is lacking, it's a failure.
  - Edge cases must be tested, or documented when they aren't; review the code closely and link the user to relevant code when only documentation is present.
- **Rollback cost (high ⚠️ / medium 👀 / low ✅):** The code is reversible once merged. Consider one-way vs. two-way doors. You can walk back through two-way doors, but not one-way doors. A PR that is cheap to roll back is lower risk. Changes that involve destructive actions or hard-to-reverse decisions are one-way doors.
- **Error detection (poor ⚠️ / decent 👀 / good ✅ / N/A ✅):** If applicable, critical flows should be monitored; If this breaks in production, someone should find out before users report it. Look for swallowed errors or fallbacks that hide breakage.

Generate a risk score for merging this PR on a scale of low - medium - high.

Verdicts:

- ⚠️ = 3
- 👀 = 2
- ✅ = 1

Weights:

- Impact = 2x
- Verification = 2x
- Rollback cost = 1.5x
- Error detection = 1x
- Alignment = 1x

Score = Σ(score × weight) / Σ(weights).

- low: < 1.5
- medium: 1.5 – < 2.25
- high: ≥ 2.25

Keep the numerical score and its calculations internal; do not include them in the output.

## FitMate 适配说明

本 skill 上游来自 `warpdotdev/common-skills`，仅做以下本地适配，未改动评分逻辑：

- **不写入 `Co-Authored-By`**。上游在提交环节会追加 `Co-Authored-By: Warp Agent <agent@warp.dev>`；FitMate 不采用该署名，提交信息由人工确认后自行填写。
- **不代为 commit / push**。本 skill 只产出风险报告，是否提交交给人决定（`AGENTS.md`：每完成一个独立功能即 git commit）。
- **敏感面按 FitMate 实际收紧**。除上游列出的 auth / payments / secrets / migrations / deps / infra 外，FitMate 额外重点关注：
  - 任何**用户数据查询缺少 `user_id` 条件** —— 最高风险，直接视为越权
  - Session / Token / 用户信息写入 `localStorage`（白名单仅表单草稿）
  - 新增或修改 `.env`、以及**修改已有 Drizzle migration**（只允许新增）
  - `lib/db/queries/` 之外的页面层 / API 层直连数据库
  - 在页面或 API 层写业务逻辑（应落 `lib` 纯函数）
- **验证证据口径**：本仓库 CI 已跑 lint / 单测 / typecheck / build（见 `.github/workflows/ci.yml`）。UX 变更的端到端证据用 `pnpm test:e2e`；性能变更的证据用 `next-bundle-optimizer`。不要以"CI 绿"代替 UX 与性能两类证据。

## Related skills

- `verify-build` — 本地跑全套检查，确认 CI 该跑的都绿了
- `next-bundle-optimizer` — 性能类改动的 profiling 证据来源