# FitMate Agent Skills

项目级手动触发的 Cursor Agent Skills。**全部 `disable-model-invocation: true` —— AI 不会自动 invoke,只在被显式调用时生效。**

## 三个 skill 一览

| Skill | 何时手动触发 | 触发后 AI 做什么 |
|---|---|---|
| `fix-bug` | "报 bug / 报错 / 测试挂了 / 排查错误" | 走 5 步:复现 → 定位 → 根因 → 修复 → 验证,最后输出 Bug fix report |
| `tdd-red` | "加新功能 / 写新规则 / 写新查询" (在写实现前) | 写**失败**单测,跑通确认 red,交付给 green 阶段;不在此 skill 写实现 |
| `verify-build` | "跑一下 / 验证 / commit 前" | 顺序跑 typecheck → lint → test → build,出绿/红报告表 |

## 怎么手动触发

在 Cursor 里**直接叫出名字**就行,任选其一:

```
"用 fix-bug 排查一下:登录页点了没反应"
"用 tdd-red 写一个 isFutureDate 的测试"
"用 verify-build 跑一遍"
```

或更自然:

```
"修一下这个 bug,用 fix-bug 流程"
"按 tdd-red 写测试"
"verify-build 看看能不能合"
```

## 工作流(典型一天)

```
1. 写新功能
   ├─ "按 tdd-red 写测试"          ← 写一个失败测试
   ├─ 写实现代码(普通对话)
   └─ "verify-build 跑一遍"        ← 全套验证
2. 改 bug
   ├─ "用 fix-bug 排查"            ← 5 步流程
   └─ "verify-build 跑一遍"        ← 验证没回归
3. 准备 commit
   └─ "verify-build 跑一遍"        ← 全绿再 commit
```

## 约束(从 AGENTS.md 继承)

所有 skill **强制遵守**项目根的 `AGENTS.md` 22 条规则,核心:

- 业务逻辑只放 `lib/<domain>/<rule>.ts` 纯函数
- 数据访问只走 `lib/db/queries/`
- 所有用户数据查询必须带 `user_id` 条件
- 禁止 `any`、`@ts-ignore`、无理由 `eslint-disable`
- 一次一个独立功能 commit
- 不改 `.env`、不修改已有 Drizzle migration(只新增)

## 文件结构

```
.cursor/skills/
├── README.md          ← 本文件
├── fix-bug/SKILL.md
├── tdd-red/SKILL.md
└── verify-build/SKILL.md
```

每个 skill 只有一个 `SKILL.md`,刻意保持精简(< 150 行,均满足 Cursor 推荐的 < 500 行上限)。详情在文件里。

## 维护规则

- **新增 skill**:在 `AGENTS.md` 里加一条 ADR 解释为什么需要,再写 SKILL.md,然后一个 commit
- **改 skill**:同样一个 commit,message 前缀 `chore(skills):`
- **删 skill**:先看 git log 决定是不是有人还在用,然后一个 commit

## 没装的 & 为什么

| 候选 | 不装的原因 |
|---|---|
| `commit-msg` (写 commit 信息) | 你已经用 `git commit -m "..."` 手写,前置不够痛 |
| `pr-review` | 还没建 CI,本地跑 verify-build 就够 |
| `e2e` 跑 Playwright 的 skill | 慢且易 flakiness,等 e2e 套件稳定再加 |
| `adr-author` (写 ADR) | docs/ 下 ADR 都是人写的判断,AI 写会丢上下文 |
