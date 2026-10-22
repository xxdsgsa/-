# Fixing a confirmed gap

Only start once triage gave the finding a `gap` verdict and the user wants it fixed.

## 1. Reproduce first

Add a test to the sibling's existing test file, modelled on the test the original fix added. `git show --stat` lists the test files it touched. Running it executes the project's code, so name the command and get the user's go-ahead first. Then run it and confirm it fails, and that it fails for the reason triage gave, not because of a typo or a missing fixture.

If the project has no tests for that sibling, create the test file where its neighbours' tests live, following their naming and structure.

## 2. Apply the change, adapted

- Follow the shape the fixed siblings already use, so the siblings converge instead of growing a third variant.
- Check `needs` in the finding. Every name listed there has to exist in the sibling, through an import, a local variable, or an equivalent, before the code can work.
- When three or more siblings need identical code, a shared helper in the type they all use is often the cleanest fix. For example, `Tool::parametersAsJson()` replaced three hand-written variants in Prism. It does widen the change, so ask the user before choosing it.

## 3. Verify like CI does

Read the CI workflow (`.github/workflows/*`, or the CI config the project uses) and run the same commands locally: formatter, static analysis, tests. Keep any changes the formatter makes to your files. Don't reformat files you didn't touch.

For FitMate, CI (`.github/workflows/ci.yml`) 依次跑：

```
pnpm exec tsc --noEmit
pnpm lint
pnpm test --run
pnpm build
```

也可直接调用本仓库的 `verify-build` skill 跑同一套。四步全绿才算通过。

## 4. Re-scan

Run the scan again. The finding should be gone, or reduced to members you deliberately left out. If a new finding appears that points at your own change, it means you changed some siblings and not others. Either cover the rest or be ready to explain why you didn't.

## 5. Hand off

`AGENTS.md` 规定「每完成一个独立功能即 git commit」，因此修完一个 finding family 就应单独提交，不要把多个 family 混在一次 commit 里。提交信息用 Conventional Commits（如 `fix(db): add user_id filter to weight query`）。

**不要**自行 push 或开 PR —— 提交后由人决定是否推送。上游原 skill 提到的 `house-style` skill 是 Prism 仓库专用的，FitMate 不适用。