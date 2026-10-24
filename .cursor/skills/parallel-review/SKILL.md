---
name: parallel-review
description: FitMate 并行审查流水线。用 4 个只读 subagent 并行审查一次改动(合规 / 类型边界 / 错误处理 / 测试覆盖),按置信度 ≥80 过滤后汇总,再由主 agent 串行实施修复。用于「审查这个改动」「这个能合吗」「帮我全面检查一遍」这类请求。
disable-model-invocation: true
---

# 并行审查流水线 (FitMate)

一次改动,四个只读 subagent 并行审,主 agent 串行改。

## 为什么是这个结构

并行 agent 各自有独立上下文,**没有文件锁**。多个 agent 同时写同一文件会 race condition,产出互相覆盖的垃圾代码。

所以硬规则:

> **并行只做只读分析。写操作必须串行,由主 agent 统一做。**

四个 reviewer 全部 `readonly: true`,Cursor 会限制它们不能改文件、不能执行改变状态的 shell 命令。这是结构性保证,不是靠自觉。

## Phase 1:并行审查(4 个 subagent 同时)

在**同一条消息**里发出 4 个 Task 调用,`subagent_type` 用 `generalPurpose`,`run_in_background: false`。必须并行 —— 分开发 4 条消息就是串行,失去意义。

```
Phase 1(并行,只读)
├─ compliance-reviewer     分层红线 / user_id / localStorage / any / 迁移
├─ type-boundary-reviewer  Zod 一致性 / any / 可空性 / 校验边界
├─ error-handling-reviewer 静默失败 / fallback / 错误码
└─ test-coverage-reviewer  覆盖缺口 / 测试质量
```

每个 Task 的 prompt 要**自包含**,因为 subagent 看不到你和用户的对话。必须包含:

1. **审查范围** —— 具体的 diff 范围。给 `git diff <base>...HEAD` 的文件列表,或让 agent 自己跑 `git diff`。
2. **项目上下文** —— 一句话说清 FitMate 是什么、技术栈、审查的红线在哪(指 `AGENTS.md`)。
3. **agent 的角色说明** —— 虽然 agent 文件里有,但 prompt 里要重申它该关注什么、忽略什么(避免三个 agent 抢同一个活)。
4. **输出要求** —— 「按你 agent 文件里的格式输出,每条带置信度分数」。

**分工去重要在 prompt 里写明**:

| Agent | 关注 | 明确不碰 |
|---|---|---|
| compliance | 分层、user_id、localStorage、迁移、禁 any | 类型细节、测试充分性 |
| type-boundary | Zod/TS 一致性、可空性、校验边界 | 业务逻辑、分层 |
| error-handling | catch、fallback、错误码 | 类型、分层、测试 |
| test-coverage | 覆盖缺口、测试质量 | 实现正确性、类型 |

## Phase 2:置信度过滤 + 汇总(主 agent,串行)

四个 agent 的输出汇到主 agent。主 agent 按这个规则处理:

**只采纳置信度 ≥80 的发现。** 低于 80 的直接丢掉,不用向用户汇报。

这来自 Claude Code `code-review` 插件的核心设计:用独立评分过滤假阳性。**没有这层过滤,四个 agent 并行的产出会把主 agent 淹没在噪音里**,最终结果是主 agent 什么都不敢改。

合并去重时注意:

- **同一个问题可能被多个 agent 报**(比如「新增 query 缺 user_id」compliance 和 type 都会碰到)。合并成一条,取**最高置信度**,标注是哪个 agent 发现的。
- 冲突时以 confidence 高的一方为准,但要保留另一方的证据。
- 严重度取**最高**的那个。

然后按严重度排序输出给用户:

```
## 审查报告

按严重度排序,已过滤置信度 <80 的发现。

| # | 严重度 | 置信度 | 问题 | 位置 | 发现者 |
|---|---|---|---|---|---|
| 1 | CRITICAL | 95 | 缺 user_id 过滤 | `src/lib/db/queries/water.ts:63` | compliance |
| 2 | HIGH | 88 | catch 吞掉 DB 错误 | `src/app/api/water-logs/route.ts:40` | error-handling |

**合计**:CRITICAL 1 | HIGH 1 | MEDIUM 3
```

### 阈值可调

默认 80。若用户说「宁可多报」,降到 75;若用户说「只要确凿的」,提到 90。在报告里说明用的阈值。

## Phase 3:串行实施(主 agent)

**先问用户,不要自动改。**

高危类别(越权、敏感数据、migration)必须让用户确认后再动手。其余可直接修。

修复时:

- 按严重度从高到低,一次改一批。
- 遵守 `AGENTS.md`:业务逻辑进 `lib` 纯函数,数据访问进 `lib/db/queries`。
- 补测试用 `tdd-red` skill 的约定(先写失败测试)。
- **一个功能一个 commit**(AGENTS.md 硬规则)。

## Phase 4:验证(串行)

改完后跑 `verify-build` skill 的四步:typecheck → lint → test → build。

出绿/红表。若有失败,回到 Phase 3 修,**不要**为了让测试变绿而改测试断言。

## 边界情况

| 情况 | 处理 |
|---|---|
| 改动很小(1-2 文件,纯类型) | 只跑 1-2 个相关 agent,别全开 |
| 改动涉及 `src/db/schema.ts` | 加一个 agent 专查「schema 改了但没加 migration」 |
| 改动涉及 localStorage | 加一个 agent 专查 localStorage 白名单 |
| 没有任何发现 | 直接说「四个维度都没发现问题」,不要硬凑 |
| 用户只要「能不能合」 | 跑完 Phase 1-2 就够,不必实施修复 |
| agent 报错/超时 | 跳过该维度,在报告里说明哪个维度没审到,**不要假装审过了** |

## 与其它 skill 的关系

| Skill | 职责分工 |
|---|---|
| `half-fixed` | 找「只修了一半的兄弟实现」—— 扫 git 历史,本流水线不查这个 |
| `validate-changes-match-specs` | 实现 vs PRD/TECH/ADR 一致性 —— 本流水线不查这个 |
| `merge-risk` | 合并前五维评分 —— 本流水线给的是问题清单,可配合用 |
| `verify-build` | 四步验证 —— 本流水线 Phase 4 直接调它 |
| `tdd-red` | 写失败测试 —— Phase 3 补测试时用它 |
| `fix-bug` | 单点 bug 排查 —— 与本流水线不重叠 |

**不要重复劳动**:如果用户同时要「审查」和「对齐 spec」,那是 `parallel-review` + `validate-changes-match-specs` 两个 skill,不是一个。

## 已知限制

- 本流水线**不查 spec 一致性**(PRD/TECH/ADR)。要用 `validate-changes-match-specs`。
- 本流水线**不查 e2e 缺口**,只看单测。e2e 归 `test-coverage-reviewer` 里提到的现有 4 个 spec。
- 本流水线**不做 PR review**。项目目前直推 main,没有 PR 流程。
