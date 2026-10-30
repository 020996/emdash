# Merge conflicts in Source Control — design

## Why

User can't tell a checkout is mid-merge/rebase, which files conflict, or how many local commits
are unpushed. VS Code shows a "Merge Changes" group, a Continue action, ahead/behind counts, and
Accept Current/Incoming/Both CodeLens inside the file. Emdash already knows all of this
(`status.operation`, `FileGitStatus.isConflicted`, `head.upstream.tracking`) but never shows it.

## Goals

- **Merge Changes group** at the top of the changes panel while conflicts exist or an operation
  (merge/rebase/cherry-pick/revert) is in progress. Lists conflicted files with a red `!` badge;
  click opens the file in the editor. Conflicted files leave the "Changed" list.
- **Operation banner** in that group: "Merging" / "Rebasing" / ... with **Continue** and
  **Abort**. Continue is disabled while conflicts remain; it stages all, then runs
  `git <op> --continue` (no editor). Abort runs `git <op> --abort` after confirmation.
- **Ahead/behind counts** shown as numbers on the push/pull buttons (`↑3`, `↓2`).
- **In-editor conflict resolution**: Monaco decorations for current/incoming blocks and CodeLens
  "Accept Current | Accept Incoming | Accept Both" above each `<<<<<<<` marker. Accepting edits
  the buffer (user saves, like VS Code).

## Non-goals

- 3-way merge editor, bisect UI, conflicts inside the diff viewer.

## Decisions (builder calls)

- New checkout mutations `continueOperation` / `abortOperation`, input `{ operation }` (one of
  merge/rebase/cherry-pick/revert), error `gitCommandErrorSchema`. Continue runs with
  `-c core.editor=true` so git never opens an editor. Both call `syncChanged()` afterwards.
- Merge group is a fixed block above the resizable sections (not a new resizable section), so
  persisted section layouts are untouched.
- Conflict parser is a pure function (`merge-conflicts-parser.ts`) with a unit test; Monaco glue
  registers one global CodeLens provider + command, decorations per editor.
