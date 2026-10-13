---
name: tdd-red
description: Write a failing test first (red phase of red-green-refactor TDD) for a FitMate feature or rule using Vitest 5 + happy-dom. Use when adding a new business rule, a new query, or a new lib function, before writing the implementation.
disable-model-invocation: true
---

# TDD Red (FitMate)

Write a **failing** test for a single behavior. The test must fail for the right reason. No production code in this step.

## When to use

- Adding a new pure function in `src/lib/<domain>/`
- Adding a new query in `src/lib/db/queries/`
- Adding a new page/server action/API route
- Fixing a bug (write the test that reproduces it first)

**Don't use for**: config changes, dependency upgrades, one-off scripts.

## Conventions (learned from this repo)

Read these once to anchor your decisions:

- Test file is **colocated** with the source: `src/lib/date.ts` → `src/lib/date.test.ts`
- Page test: `src/app/<route>/page.test.tsx`
- Coverage scope (from `vitest.config.mts`): `src/lib/**` excluding `auth/**` and `.d.ts`
- `@/` alias → `src/`
- happy-dom for component tests, no separate setup file
- Globals on (`describe`, `it`, `expect` available without import), but **importing explicitly is preferred** for tree-shaking and IDE jumps

## Workflow

```
- [ ] 1. Identify the single behavior
- [ ] 2. Write the test
- [ ] 3. Run it — confirm it fails for the right reason
- [ ] 4. Hand off to green phase
```

### Step 1: One behavior per test

State in one sentence: "When the user does X with input Y, the function returns Z."

If you find yourself writing "and" in that sentence, split into two tests.

Examples for this codebase:
- "When a date is in the past, `isFutureDate()` returns false"
- "When two cycles overlap, `assertNoOverlap()` throws"
- "When a user requests stats for last week, the query returns 7 rows scoped to that user_id"

### Step 2: Write the test

Template for a pure function (most common in this repo):

```ts
// src/lib/<domain>/<file>.test.ts
import { describe, it, expect } from "vitest";
import { targetFunction } from "./<file>";

describe("<targetFunction>", () => {
  it("<does X when Y>", () => {
    // Arrange
    const input = /* concrete value, not a mock */;

    // Act
    const result = targetFunction(input);

    // Expect
    expect(result).toBe(/* expected */);
  });
});
```

Template for a Drizzle query test (see `src/lib/db/queries/stats.test.ts` for the real pattern):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb, resetTestDb } from "@/lib/db/test-utils";  // if exists
import { targetQuery } from "./<file>";

describe("<targetQuery>", () => {
  beforeEach(async () => { await resetTestDb(); });

  it("returns only rows for the given userId", async () => {
    // seed two users, call query(userIdA), expect only userIdA's rows
  });
});
```

If `test-utils` doesn't exist yet, write a thin `setupTestDb()` in the test file using `pglite` or an in-memory `pg` mock — never hit a real Neon branch.

### Step 3: Run and confirm RED

```bash
pnpm test --run src/lib/<domain>/<file>.test.ts
```

The test **must** fail. Check the failure message:

| Failure message | Verdict |
|---|---|
| `Cannot find module './<file>'` | ✅ correct — function doesn't exist yet |
| `targetFunction is not a function` | ✅ correct — export missing |
| `expected X to equal Y` | ✅ correct — but verify the assertion is the one you intended |
| Test passes | ❌ **STOP** — your test doesn't cover the behavior; rewrite |
| Different file's error | ❌ wrong test ran, fix the path |

### Step 4: Hand off

In the chat, say: "Red phase done — `<path>` failing as expected. Ready for green."

Then stop. Do **not** write the implementation in this skill. That's `tdd-green` (not yet built) or just normal coding.

## Quality bar for a good red test

A reviewer should be able to read the test and know exactly what the function does, without reading the source. Concretely:

- **Concrete inputs, not `null` or empty arrays as the only test case** — add at least one positive + one edge case
- **Assertion on the observable** (return value, thrown error, side-effect on a fake DB), not on internal calls
- **No mocks for things you own** — if the function depends on another of your modules, import the real one. Reserve mocks for boundaries (DB, network, time, random)
- **One assertion focus per test** — multiple `expect` is fine if they describe one behavior; multiple behaviors in one `it` is not

## Anti-patterns

- ❌ "Test all the things" — one `it()` per behavior, not one `it()` per function
- ❌ Mocking the function under test
- ❌ Writing the implementation first and the test second ("reverse TDD" — usually means the test mirrors the code, not the spec)
- ❌ `expect.anything()` — says nothing
- ❌ `expect(result).toBeDefined()` — almost always wrong, assert a specific value
- ❌ Snapshot tests for non-UI logic — snapshots rot, tests pass when they shouldn't

## After green

Once implementation lands and `pnpm test` is green, run the `verify-build` skill before committing.
