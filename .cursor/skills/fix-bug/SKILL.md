---
name: fix-bug
description: Diagnose and fix bugs in the FitMate Next.js 16 codebase following a 5-step workflow (reproduce → locate → root-cause → fix → verify). Use when the user reports a bug, an error, a test failure, or unexpected behavior in pages, API routes, Drizzle queries, or auth flows.
disable-model-invocation: true
---

# Fix Bug (FitMate)

Structured debugging flow for Next.js 16 App Router + Drizzle + Better Auth stack.

## When to use

- User reports a bug / error / "it doesn't work"
- Test fails (`pnpm test` 或 `pnpm test:e2e`)
- Production error in `pnpm dev` console
- Type error from `pnpm tsc --noEmit` (执行时用 `pnpm exec tsc --noEmit`)

**Don't use for**: new features (use plain planning), build perf issues (use `verify-build`).

## 5-step workflow

Copy this checklist and tick as you go:

```
- [ ] 1. Reproduce — get a reliable repro
- [ ] 2. Locate — narrow to a file:line
- [ ] 3. Root-cause — explain WHY, not just WHAT
- [ ] 4. Fix — minimal change, follow AGENTS.md
- [ ] 5. Verify — typecheck + test + manual
```

### Step 1: Reproduce

Goal: a single command or click sequence that triggers the bug 100%.

- Read the user's report. Ask clarifying questions (use AskQuestion if multiple paths exist) — keep to ≤ 3 questions.
- Check the dev server console: `pnpm dev` (Next.js 16 dev overlay shows the file:line in red).
- For data bugs: write a one-off script in `scripts/repro-*.ts` that calls the failing query directly. Delete the script after the bug is fixed.
- For e2e: `pnpm test:e2e --grep "<test name>" --headed` to see the failure visually.

Output: a 1-line statement of "given X, doing Y produces Z error".

### Step 2: Locate

Narrow from "the app" → "the file" → "the function" → "the line".

| Symptom | First place to look |
|---|---|
| 500 from `/api/*` | `app/api/**/route.ts` → handler function |
| RSC hydration error | The page component that fetches the data |
| Drizzle "relation X does not exist" | `src/db/schema/*.ts` + `src/db/queries/*.ts` |
| Auth redirect loop | `src/lib/auth.ts` + Better Auth config |
| Client component "useState not a function" | Check `'use client'` directive at top |
| Zod parse error | The Zod schema, not the consumer |

**Rule of thumb**: read the file top-to-bottom once before changing anything. Most Next.js 16 bugs are in the data flow, not the render.

### Step 3: Root-cause

State the cause in one sentence. Test it with: "if I revert this, does the bug go away?"

Common Next.js 16 + Drizzle root causes:
- **Forgot `await` on a Drizzle query** → `db.select().from(...)` returns a Promise; awaiting it returns a row, not an array.
- **Missing `userId` filter** → violates AGENTS.md "所有用户数据查询必须带 user_id 条件".
- **Business logic in a page/API** → violates "业务逻辑禁止写在页面/API 层". Move to `lib/<domain>/<rule>.ts`.
- **`useSearchParams()` without `<Suspense>`** → Next.js 16 will fail the build with a clear error.
- **Drizzle migration drift** → `pnpm db:generate` shows diff but `db:migrate` not run.
- **Server Action called from client** without `'use server'` directive.

### Step 4: Fix

Rules — taken from `AGENTS.md`, do not relax:

- **Minimum diff**. If the fix needs >50 lines, refactor first into a separate commit.
- **Type-safe**: no `any`, no `as unknown as X`. Use Zod to narrow.
- **Pure functions** for business rules (`src/lib/<domain>/<rule>.ts`), import into page/API.
- **Queries live in** `src/lib/db/queries/*.ts`, never inline in pages.
- **No new dependencies** — reuse what's in `package.json`.
- **No edits to** `.env`, `drizzle/*.sql` migration files (only new migrations allowed).
- If the bug is in a generated file, fix the source (e.g. the query function), not the generated output.

### Step 5: Verify

Run all three; all must pass:

```bash
pnpm exec tsc --noEmit          # type check
pnpm test                       # unit tests (Vitest)
pnpm lint                       # ESLint
```

Then the original repro (Step 1) should no longer trigger.

If a regression test is missing, add one in `src/lib/<domain>/__tests__/<rule>.test.ts` before closing the bug. Test must fail on `main` and pass after the fix.

## Output report

At the end, write this to the chat (not a file):

```markdown
## Bug fix report

**Root cause**: <one sentence>
**Files changed**: <list with line ranges>
**Verification**: typecheck ✅ / unit ✅ / lint ✅ / repro ✅
**Regression test**: <path or "added">
**Risk**: <low/medium/high + one-line reasoning>
```

## Anti-patterns to avoid

- "Just add a try/catch" → hides the bug, doesn't fix it
- "Disable the test" → test is documenting intent
- "It works on my machine" → re-run Step 1, the repro is wrong
- Fixing symptoms (multiple `if` checks) instead of root cause
- Editing more than 3 files for one bug — likely a refactor disguised as a fix

## Related

- After fixing, run `verify-build` skill to confirm full pipeline green
- If the fix reveals a design issue, escalate to user — don't refactor without asking
