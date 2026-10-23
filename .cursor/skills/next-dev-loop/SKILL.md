---
name: next-dev-loop
description: Verify Next.js runtime behavior after editing app code in FitMate. Use this skill to confirm a change actually works in a running app — not just that it compiles or type-checks. Combines /_next/mcp (Next.js's view) with agent-browser (the browser's view). Requires a running `next dev`.
---

# next-dev-loop

The edit/verify rhythm during `next dev` — make a change, then confirm it actually works at runtime, not only that the types or the build are happy.

You verify through two views of the same running app:

- **`/_next/mcp`** — an HTTP endpoint Next.js exposes about itself. Knows framework-specific things: routes, segments, RSC, server actions, server logs, and errors as Next.js saw them. Call `tools/list` for the current surface.
- **`agent-browser`** — a CLI that drives a real Chrome. Knows framework-agnostic browser things: DOM, console, network, React fiber, vitals. Before driving it, run `agent-browser skills get core` once for the version-matched usage guide — don't guess subcommands from memory.

The two views cross-check each other.

## requires

- Next.js **16.3+** with **Turbopack** — `/_next/mcp` plus the proactive compile check via `get_compilation_issues`.
- `agent-browser` **>= 0.31.1** — React introspection, worktree-scoped `session id`, idempotent `--restore`, and launch flag reconciliation. These are hard floors, not soft preferences. If anything is missing, tell the user how to upgrade and stop. Don't fall back to grepping source or to a weaker probe — this skill assumes both views are live at the versions above.
  - Upgrade Next.js: `pnpm next upgrade` (or `npx next upgrade`).
  - Install or upgrade `agent-browser`: `npm i -g agent-browser@latest`. If the CLI isn't on `PATH`, install it before continuing — preflight expects to invoke it directly.

## preflight

Once per session, confirm both views are live.

1. **Open `agent-browser` at the target URL, restoring saved login state when present.**

   First derive one stable session id for this checkout and use it for every `agent-browser` command:

   ```bash
   SESSION="$(agent-browser session id --scope worktree --prefix next-dev-loop)"
   export AGENT_BROWSER_SESSION="$SESSION"
   export AGENT_BROWSER_RESTORE="$SESSION"
   ```

   Then open the target URL:

   ```bash
   agent-browser --session "$SESSION" --restore --enable react-devtools open
   ```

   `--scope worktree` keeps parallel worktrees and copied checkouts from colliding. Bare `--restore` uses the session id as the persistence key, loads saved cookies/localStorage before navigation when present, and auto-saves state on close. Always pass the desired launch flags on `open`; agent-browser will reuse, relaunch, or restart its scoped background state as needed.

   Keep routine verification headless. If the user asks to see the UI, open the current URL in the coding harness's inline browser. It is a separate browser context, so do not assume state carries over.

   When login or existing `agent-browser` state must carry over, reopen that session headed instead:

   ```bash
   agent-browser --session "$SESSION" --restore --headed --enable react-devtools open
   ```

   Pause while the user drives login, then continue with the same session and keep it headed for the rest of the loop.

2. Probe `/_next/mcp` (`tools/list`) — confirm it's reachable and lists `get_compilation_issues`. First read the port off the `next dev` banner; if it isn't 3000, set `NEXT_MCP_URL=http://localhost:<port>/_next/mcp` before probing:
   - Unreachable → either `next dev` isn't running, or Next.js is below 16.3. Check `package.json` to disambiguate, then refuse.
   - `get_compilation_issues` not in the list → Next.js below 16.3. Refuse and tell the user to upgrade.

3. `get_compilation_issues` doubles as a Turbopack probe. An error response of `"Turbopack project is not available..."` means the user is on webpack. Refuse — Turbopack is required.

4. `get_routes` → your route map for the rest of the session.

## loop

### before the edit — narrow the scope

Ask the running app, not the codebase. `/_next/mcp` knows which files rendered the current route; use those as your search scope. Runtime introspection stays cheap as the codebase grows; agentic search doesn't.

### after the edit — verify

Four failure modes. Check each:

- **Compiles** — `get_compilation_issues`.
- **Runs without errors** — `/_next/mcp` (server and bubbled-up browser errors both surface here).
- **Behaves as intended** — `agent-browser` drives the page; assert what the user actually sees.
- **React-level behavior** — `agent-browser` with react-devtools enabled exposes the component tree, props, state, and render counts. Anchor framework-level checks here (extra renders, server/client boundary shifts, suspense fallbacks) — DOM asserts alone miss them.

Pick the specific tool from `tools/list` or the agent-browser manual rather than from memory.

## gotchas

- **Preserve `.next` while the development server is running.** Moving or deleting it disconnects the server from its generated state and discards incremental caches. Moving it to a backup is still a reset. If a production build needs isolated output, configure a separate `distDir`.
- **Every `agent-browser` command must know your session and restore key**, or it may use an empty default browser or fail to save login state. Easiest: export both `AGENT_BROWSER_SESSION="$SESSION"` and `AGENT_BROWSER_RESTORE="$SESSION"` at the top of each shell you run agent-browser in. If you do not export them, pass `--session "$SESSION" --restore` on every command.
- **When the two views disagree, suspect the tooling first.** If `agent-browser` says a route is broken but `/_next/mcp` and the server say it rendered cleanly, a stale or misdirected browser session is the likelier cause than a real bug — reconcile the views before debugging the app.
- Confirming a click or navigation: the page settles a beat later, so wait with `wait --load networkidle` (no path to get wrong), then snapshot/read to confirm the page. Avoid `wait --url` unless you pass the link's exact href — a guessed or placeholder path won't match the real URL and times out after 25s.
- A blank read, empty snapshot, `about:blank`, or a "no browser session" error — right after `open` or after a click (even if `open` reported the page) — is the browser dropping the page (a stale session), not a broken route. Reopen your session at the URL with the same launch flags as the active loop, then re-snapshot. If still blank, run `agent-browser --session "$SESSION" --restore close`, then reopen with those same flags. Don't fall back to `curl`; it bypasses the browser you're testing.
- React introspection output is stale after navigation. Re-run.
- `/_next/mcp` replies are SSE — read the JSON off the `data:` line. On PowerShell: `(Invoke-WebRequest ...).Content -split "`n" | Where-Object { $_ -like 'data: *' } | ForEach-Object { $_.Substring(6) }`. On bash: `sed -n 's/^data: //p'` (a plain `sed 's/^data: //'` leaves the `event:` line and the parse fails).
- `get_errors` and `get_page_metadata` need at least one navigation to populate.

## reference

All tools below are present once preflight passes. If `tools/list` is missing any of them, preflight should have refused — re-check.

```
# /_next/mcp notes
get_project_metadata   projectPath, devServerUrl, bundler
get_routes              fs-scan; no browser session needed
get_errors              runtime + build; needs a browser session; includes browser-side errors caught by the dev server
get_page_metadata       segment trie + routerType; needs a browser session; use as a discovery shortcut for which files power a route
get_logs                returns logFilePath
get_server_action_by_id hashed id → file + functionName
get_compilation_issues  Turbopack only; errors on webpack ("Turbopack project is not available")
```

## teardown

Close the session with the same session and restore context:

```
agent-browser --session "$SESSION" --restore close
```

`close` saves that session's cookies and storage so the next loop's `--restore` open keeps the user logged in. Leave `next dev` up for the next loop.

## Report

Next.js friction: only participate in agent feedback when managed Next.js feedback instructions are already loaded for the project. Their presence means the feature is enabled; their absence means it is disabled. When enabled, add qualifying feedback candidates found during verification to the feedback candidate queue for the current user request, then continue verification. Do not run the feedback command or open review forms during the loop or at this Skill's teardown. The managed instructions own the single reporting pass immediately before the final response. If they are absent, do not queue or report feedback.

## FitMate 适配说明

本 skill 上游来自 `vercel/next.js` 官方 skills（canary 分支），仅做两处本地适配：

- **会话示例改为 PowerShell 语法**。本仓库开发环境是 Windows + PowerShell，SSE 解析一行已给出 `Invoke-WebRequest` 写法；若在 bash 环境下用同样的 skill，用回上游的 `sed` 版本。
- **不改验证流程**。四类失败模式（编译 / 运行无错 / 行为符合预期 / React 层行为）保持原样。

**注意**：已完成前置安装（2026-10-23）：

- `agent-browser@0.39.2` 全局安装（`npm i -g agent-browser@latest`），满足 `>= 0.31.1` 下限。
- 浏览器二进制已装：`agent-browser install` → Chrome 156.0.8078.47，位于 `C:\Users\xxz\.agent-browser\browsers\chrome-156.0.8078.47`。
- 本项目 Next.js 为 `16.3.8`，满足 `16.3+` 且默认 Turbopack，preflight 第 2/3 步可通过。

⚠️ **Node 版本警告**：安装时报 `EBADENGINE` —— `agent-browser@0.39.2` 要求 `node >= 24.0.0`，而本机 nvm4w 当前为 `20.20.2`。实测 CLI、session、Chrome 渲染均正常，暂不影响使用。但若后续遇到 agent-browser 侧的怪异报错，优先用 `nvm install 24 && nvm use 24` 排查（Next.js 16.3.8 本身支持 Node 20，所以 `pnpm dev / build / test` 不受影响）。

## Related skills

- `verify-build` — 不需要跑起来时的静态全套（typecheck / lint / test / build）
- `next-bundle-optimizer` — 首屏负载审计与优化，本 skill 是它的验证环节