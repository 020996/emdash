# Problems Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `Problems` mode in the task bottom drawer listing the task's open-file diagnostics.

**Architecture:** Editor slice owns diagnostics reading (`useTaskProblems`) and the `ProblemsPanel`
under `contributions/browser` (features may import other features' `contributions`). Terminals
drawer adds a third mode and renders the panel over the PTY area.

**Tech Stack:** React, MobX observer, Monaco marker API, Vitest browser tests.

**Spec:** `docs/superpowers/specs/2026-10-28-problems-tab-design.md`

## Global Constraints

- Only files the task has open; no new Wire/LSP procedures.
- Terminal PTY content stays mounted in every mode.

## Review Focus

1. Markers from another task's open files must not appear (filter by registered task refs).
2. Monaco not loaded yet → empty state, no crash.
3. Switching back to Terminals restores the previous terminal/script selection.

---

### Task 1: Shared location opener + task refs

**Files:** Modify `apps/emdash-desktop/src/core/features/editor/browser/lsp/language-services.ts`.

**Produces:** `openEditorLocation(context, ref, range: Monaco.IRange): boolean`;
`taskLanguageRefs(taskId: string): { ref: HostFileRef; root: HostFileRef; context }[]`.

- [ ] Extract the `openLocation` lambda body into `openEditorLocation`; installLanguageServices uses it.
- [ ] `taskLanguageRefs` filters `registrations` by `context.taskId`.

### Task 2: `useTaskProblems` + `ProblemsPanel`

**Files:** Create `apps/emdash-desktop/src/core/features/editor/contributions/browser/problems/problems-panel.tsx`.

**Produces:** `useTaskProblems(taskId): ProblemFile[]` (`{ key, ref, name, directory, problems: { severity, message, source?, code?, range }[] }`), `ProblemsPanel({ files, context })`.

- [ ] Hook: `monacoBootstrap.getMonaco()`; version state bumped by `onDidChangeMarkers`; map task refs by `encodeFacetUri(ref, { kind: 'buffer' })`; group markers whose resource matches; sort severity desc, then line.
- [ ] Panel: empty state "No problems in open files"; file header + rows; click → `openEditorLocation`.

### Task 3: Drawer mode

**Files:** Modify `terminals/browser/task-terminal/terminal-drawer-tab-bar.tsx`, `terminals/contributions/browser/task-terminal/terminal-panel.tsx`.

- [ ] `TerminalDrawerMode` adds `'problems'`; tab bar takes `problemCount`, shows `Problems` tab with badge, no item tabs in that mode.
- [ ] Panel: `handleModeChange('problems')` only sets mode; renders `ProblemsPanel` absolutely over the PTY content when mode is `problems`.

### Task 4: Verify

- [ ] `pnpm run format && pnpm run typecheck`; oxlint on touched files; run app, open a file with a diagnostic, check list + click-through.
