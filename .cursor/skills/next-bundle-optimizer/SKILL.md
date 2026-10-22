---
name: next-bundle-optimizer
description: Audit and reduce Next.js browser initial-load work in FitMate. Use for slow route startup, oversized client bundles, duplicate browser dependencies, or features that can wait for interaction.
---

# Bundle optimizer

## 1. Set the scope

Analyze the whole app by default, covering all routes and shared client dependencies. Narrow the scope only when the user specifies a route, dependency, feature or other subset.

Choose **audit** or **fix** mode. Audit is the default: generate analyzer artifacts and report candidates while leaving application source, dependencies and lockfiles unchanged. Fix mode requires an explicit request to change the app. Ask before changing visible behavior, timing, compatibility or a trust boundary.

**Done:** the whole-app or user-specified scope, mode and intended behavior are recorded. A request to capture or export data is audit mode, not permission to fix.

## 2. Capture and export a baseline

Run from the app directory with `pnpm`. Read `next analyze --help` for capture options and `next analyze export --help` for replay options in the installed CLI. Reuse a selected saved snapshot, or capture with a distinctive name first; then export it through gzip at its default compression level. Keep before/after `.jsonl.gz` files separate.

**Sandbox requirement:** If the agent's sandbox blocks TCP port binding, it MUST run the `next analyze --output` capture outside the sandbox. Do not attempt the capture inside that sandbox, even though `--output` does not serve the analyzer UI.

Run the pipeline in Bash:

```bash
set -o pipefail

# Capture only when a new baseline is needed
pnpm exec next analyze --output --snapshot 'audit-before-unique-1'

pnpm exec next analyze export --snapshot 'audit-before-unique-1' \
  | gzip > /tmp/analyze-app-before.jsonl.gz
```

`--output` builds and saves binary/UI artifacts without serving. `next analyze export` reads a saved snapshot without building; stdout is one typed JSON record per line, with errors on stderr. Omit `--route` for whole-app analysis; add it for a user-specified route. The route filter keeps the whole-app module graph, so scope it in the next step.

For a custom `distDir`, replay with `--dist-dir <path>` (relative or absolute): capture loads the app config, replay does not. `--snapshot <name>` selects a retained name; omission selects the newest snapshot. Capture generates a unique timestamp name when omitted, and **replaces** an existing capture when an explicit name is reused. Use distinct before/after names, including names with spaces, to preserve both baselines.

For interactive exploration, capture without `--output` to serve the UI; `next build --analyze` also produces replayable data.

**Done:** the chosen capture is identified, export succeeded, and the baseline file, snapshot name and analysis scope are recorded.

Check the whole pipeline's exit status before processing the compressed file: `pipefail` prevents gzip from hiding a failed export. Export validates one route at a time, so a failure can leave a partial archive even if `gzip -t` accepts it. Discard output when export or gzip fails.

**Windows note**: FitMate 开发环境是 PowerShell。上面的 `set -o pipefail` 与 `| gzip` 需换成等价写法，或在 Git Bash / WSL 下执行。

## 3. Interpret the evidence

Resolve the schema from the app's **installed Next.js**, using its Node launcher:

```bash
pnpm exec node -p "require.resolve('next/analyze/graph-v1.schema.json')"
```

Read its descriptions for record meanings, joins, attribution and coverage. Stream decompression with `gzip -dc /tmp/analyze-app-before.jsonl.gz` into a line-oriented analysis script rather than loading the whole dump into context. Use the schema to interpret client/server contributions across every route in scope and choose the metric.

**Done:** the baseline's route-attributed client/server contributions and the metric are identified.

Treat this as **build evidence**: claims about observed browser requests, timing or transfer savings need separate evidence.

## 4. Explain a candidate

Inspect actual project source and exact importers. Rank client-output contributions across the whole app, or within the user-specified scope, by attributed size, repetition, likely runtime cost, need before interaction and correctness risk.

### Community → min-cut pass

For broad audits seeking opportunities across multiple features or a large contributor list, run **community detection → target selection → directed min-cut → source validation** after the initial ranking. Read [Graph methods](references/graph-methods.md) before constructing the graph or running solvers.

1. Rank detected communities by scoped client-output attribution and inspect their inbound importers.
2. Select large communities, or optional feature regions within them, that can plausibly wait for interaction. Record why each selected region is optional under the route's render conditions.
3. Run directed min-cuts from the verified client roots to those targets to find small sets of importer changes that could detach them.
4. Validate the cut edges against source and behavior constraints; account for each investigated target as a candidate, rejected cut or evidence gap.

For a narrow audit of a named dependency or feature, use direct importer reasoning when it fully accounts for the relevant paths and proposed boundary; record why the paired pass adds no useful target discovery. If graph evidence or tooling blocks the pass, record the blocker and limit the conclusions accordingly.

### Graph-evidence checklist

Before proposing an edit, record these items for each candidate. Mark an inapplicable item with its reason; give missing evidence an explicit gap.

- **Scope:** name the affected routes, snapshot, render conditions, client/server output class, exact target identities and metric. For reachability claims, identify every selected client root, including applicable client references.
- **Coverage:** summarize relevant unsupported outputs and absent group triggers, and their effect on the claim. Scope conclusions to the known subgraph when completeness is uncertain.
- **Attribution:** count each selected output contribution once. Record repeated-record handling and distinguish source paths from module identities; explain any mapping used for solver weights and preserve unknown weights as gaps.
- **Reachability:** for a lazy boundary, check **all** synchronous root-to-target paths, alternate importers and cycles, including a target that is itself a root. Record which paths the proposed boundary severs and which stay reachable. Verify async and erased type-only imports against source.
- **Source checks:** inspect import triggers, mount-time preloading, module side effects and shared routes. Record the conditions under which an async import executes. The graph establishes indexed reachability; an after snapshot verifies emitted outputs and attribution changes.
- **Method:** record the chosen method, its parameters and why it fits the candidate. For lazy interaction features, duplicate packages, server-rendered display work or other attributed assets, read the matching section in [Fix patterns](references/fix-patterns.md) before proposing an edit.

**Done:** the paired pass and its target dispositions are recorded, or the narrow-scope skip reason or blocker is explicit. Every candidate has a completed checklist, exact source/importer, proposed edit and named behavior checks. Label heuristics as heuristics and qualify conclusions affected by evidence gaps; the report step completes **audit** mode.

## 5. Verify one change — fix mode only

Make one small, cohesive change. Capture/export an after snapshot with a new name and compare the **same analysis scope, output class and metric** with the baseline. For whole-app analysis, account for changes across all routes, including shared dependencies.

Run relevant behavior tests and type-check; use [`next-dev-loop`](./next-dev-loop/SKILL.md) when verifying the edit in the running app. If `next-dev-loop` isn't usable (for example `agent-browser` isn't installed), fall back to `pnpm test:e2e` and say so explicitly rather than claiming runtime verification happened.

**Done:** retain the change only when the scoped metric improves and the intended behavior passes its checks. Revert a change that fails either condition. If checks are blocked, report the unverified edit and blocker rather than accepting it. Record the accepted after snapshot as the next baseline before another edit.

## 6. Report and stop

Audit reports candidates; fix reports accepted edits and any reverted or unverified attempts. Include snapshot names, scoped attribution/deltas, exact source/importer, behavior-check results and blockers. For a graph cut, include its route/render conditions, roots/target and unknowns. Distinguish source facts, build evidence, heuristics and separately observed runtime facts.

**Done:** every scoped candidate or attempted edit is accounted for, with evidence or a stated gap.

## FitMate 适配说明

本 skill 上游来自 `vercel/next.js` 官方 skills（canary 分支），适配改动：

- 移除上游对 `next-cache-components-optimizer` / `next-partial-prefetching-optimizer` 的交叉依赖与 `npx skills add` 自动安装提示——本仓库未安装这两个 skill，且 `AGENTS.md` 禁止自动装依赖。静态 App Shell 的优化不在本 skill 覆盖范围内。
- 第 5 步的运行期验证给出 Playwright 兜底路径。
- 第 2 步补充 Windows / PowerShell 执行备注。
- 包管理命令统一为 `pnpm`（上游混用 npm/npx）。
- 审计流程、证据清单与图方法保持原样，未削弱。

## Related skills

- `next-dev-loop` — 运行期验证的配套 skill
- `verify-build` — 静态全套（typecheck / lint / test / build）