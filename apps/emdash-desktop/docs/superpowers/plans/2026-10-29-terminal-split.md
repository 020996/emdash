# Terminal drawer split Implementation Plan

**Goal:** VS Code-style horizontal split terminals in the bottom drawer.

**Spec:** `docs/superpowers/specs/2026-10-29-terminal-split-design.md`

### Task 1: Split helpers + memento

- Modify `src/core/features/tasks/contributions/mementos.ts`: v1 schema gets
  `splits: z.array(z.array(z.string())).optional()`.
- Create `src/core/features/terminals/api/browser/task-terminal/terminal-splits.ts`:
  - `splitGroupOf(splits: string[][] | undefined, id: string): string[]` — group containing id, else `[id]`.
  - `addToSplit(splits, anchorId, newId): string[][]` — insert newId after anchorId (new group if none).
  - `pruneSplits(splits, live: ReadonlySet<string>): string[][]` — drop dead ids, drop groups < 2.
- Test `terminal-splits.test.ts`: add creates group, add to existing group inserts after anchor,
  prune drops dead ids and singleton groups.

### Task 2: Store + composition

- `TerminalTabViewStore`: `splitGroup(id)`, `addSplit(anchorId, newId)` (also moves newId right
  after anchorId in tabOrder), `syncTerminalIds` prunes splits; `updateSelection` carries `splits`.
- `TaskComposition.splitTerminal()`: anchor = active terminal; no anchor → `openNewTerminal()`.

### Task 3: UI

- Tab bar: `onSplitTerminal` prop, `Columns2` button after `NewTerminalButton`.
- Panel: `usePaneScope(..., { canSplit, splitPane })`; when the active terminal's visible group
  has 2+ members render `Resizable.Group` horizontal with one `TerminalPtyContent` per member.

### Verify

`pnpm run typecheck`, vitest for `terminal-splits.test.ts` + `terminal-tab-view-store.test.ts`,
manual check in dev app.
