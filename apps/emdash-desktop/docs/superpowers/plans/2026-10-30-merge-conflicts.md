# Merge Conflicts Implementation Plan

**Goal:** Show merge state, conflicted files, Continue/Abort, ahead/behind counts, and in-editor
Accept Current/Incoming/Both.

**Spec:** `docs/superpowers/specs/2026-10-30-merge-conflicts-design.md`

### Task 1: Backend continue/abort

- `packages/core/src/runtimes/git/api/checkout/contract.ts`: mutations `continueOperation`,
  `abortOperation` — input `{ operation: z.enum(['merge','rebase','cherry-pick','revert']) }`.
- `git-checkout.ts`: `continueOperation(op)` = `git -c core.editor=true <op> --continue`;
  `abortOperation(op)` = `git <op> --abort`, both via `commandMutation`.
- `checkout-resource.ts` + `checkout-runtime.ts`: wire mutations, `syncChanged()` after.
- Test in `git-checkout.test.ts`: real temp repo merge conflict → abort clears operation;
  resolve + continue creates merge commit.

### Task 2: Store + Merge Changes group

- `git-checkout-store.ts`: `operation`, `conflictedChanges` computed; `continueOperation()`,
  `abortOperation()`; `unstagedFileChanges` excludes conflicted.
- New `merge-changes-section.tsx` rendered above sections in `changes-panel.tsx`.

### Task 3: Ahead/behind counts

- `git-status-section.tsx`: show counts next to arrows when > 0.

### Task 4: Editor conflict CodeLens

- `editor/browser/monaco/merge-conflicts-parser.ts` (+ test): `findConflicts(lines)`,
  `resolveConflict(conflict, lines, kind)`.
- `editor/browser/monaco/merge-conflicts.ts`: global CodeLens provider + command, per-editor
  decorations; installed from `editor-provider.tsx`.

Verify: typecheck, focused vitest, lint, dev check with a real conflict.
