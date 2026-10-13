---
name: verify-build
description: Run the full pre-commit verification pipeline (typecheck + lint + unit tests + production build) for FitMate and report a single green/red status. Use before committing, before opening a PR, or whenever the user says "run checks" / "verify" / "is it green".
disable-model-invocation: true
---

# Verify Build (FitMate)

Single entry point for "is the project healthy?". Runs the four commands every PR must pass and summarizes.

## When to use

- Before `git commit` on a feature branch
- Before pushing / opening a PR
- After a `pnpm install` or dependency change
- After a Drizzle migration
- Whenever the user asks "does it build?" / "are we green?"

**Don't use for**: hot fix on dev (just `pnpm dev`); single-file edits (just `pnpm lint <file>`).

## Pipeline

Run in this order — each step gates the next:

```
1. pnpm exec tsc --noEmit      →  type errors?
2. pnpm lint                    →  ESLint clean?
3. pnpm test                    →  all unit tests pass?
4. pnpm build                   →  Next.js production build succeeds?
```

If any step fails, **stop** and fix before running the next. Reasoning below.

| # | Command | Why it goes first |
|---|---|---|
| 1 | `tsc --noEmit` | Cheapest, catches the most issues; if types are wrong, lint/test output is misleading |
| 2 | `pnpm lint` | Catches `any`, unused vars, AGENTS.md style rules; faster than tests |
| 3 | `pnpm test` | Vitest 5; unit only (excludes e2e, which is separate) |
| 4 | `pnpm build` | Slowest; runs RSC compile, route checks, bundle analysis. The real gate for "can this ship" |

`pnpm test` is **unit only**. For e2e, run `pnpm test:e2e` separately (requires `pnpm test:e2e:install` once). Don't include e2e in this pipeline — it's slow and flaky on a single dev machine.

## Run them — concretely

Use the `pnpm` scripts that already exist in `package.json`. Don't invent flags.

```bash
# From repo root
pnpm exec tsc --noEmit
pnpm lint
pnpm test --run          # --run to avoid watch mode in CI/agent
pnpm build
```

If `pnpm test` is already running in watch mode from another terminal, prefer `pnpm test --run` (it forces single-pass). The `--run` flag works on Vitest 5.

## Output format

Report exactly this shape in the chat. Compact, scannable, no fluff.

```markdown
## Verify report

| Step | Status | Time | Notes |
|---|---|---|---|
| typecheck (`tsc --noEmit`) | ✅/❌ | <s> | <error count or "clean"> |
| lint (`pnpm lint`) | ✅/❌ | <s> | <error/warn count> |
| unit tests (`pnpm test`) | ✅/❌ | <s> | <X>/<Y> passing, <Z> skipped |
| build (`pnpm build`) | ✅/❌ | <s> | <route count or error summary> |

**Overall**: ✅ green / ❌ <N> step(s) failing
**Blockers**: <list of files:line if any>
```

If a step fails, the "Notes" column should be the **first 3 errors only** — not a 200-line paste. The user can scroll if they want more.

## Decision rules on failure

- **typecheck fail** → fix types first; do not touch logic until `tsc` is clean. `any` and `as unknown as X` are forbidden by `AGENTS.md`.
- **lint fail** → read the rule name; if it's a pre-existing rule and the violation is in code you didn't change, fix it in the same commit (one-line fixes are fine, larger refactors go in a separate commit).
- **test fail** → run `pnpm test --run <path-to-file>` to isolate. If the failure is a **flaky** test (passes on rerun), report it as flaky — don't auto-fix; user decides. If deterministic, use the `fix-bug` skill.
- **build fail** → read the route name in the error. Most Next.js 16 build failures are: missing `Suspense` around `useSearchParams`, server/client boundary mismatch, or a circular import. Fix root cause, not the symptom.

## Common shortcuts (don't use these — explain why)

- ❌ `// @ts-ignore` — pushes the error to runtime
- ❌ `eslint-disable-next-line` without a reason comment — accumulates tech debt
- ❌ `pnpm test --update` / snapshot regen to make red tests green — hides intent
- ❌ `next.config.ts` `eslint.ignoreDuringBuilds: true` — disables the check globally
- ❌ Skipping the build step locally because "CI will catch it" — CI is slow, you lose the feedback loop

## After green

The pipeline is green. The user can:
1. `git add` + `git commit` (per `AGENTS.md` rule: one feature per commit)
2. Push and open a PR
3. Run `pnpm test:e2e` if the change touches a user-facing flow

Suggest the next step, don't do it automatically.

## Related skills

- `fix-bug` — for the "build/test fails, fix it" loop
- `tdd-red` — for the "add a new test" workflow
