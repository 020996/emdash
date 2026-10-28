# File Tree ⇄ Finder Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drag a tree file onto Finder as a real file; copy/paste files between the tree and Finder.

**Architecture:** Main resolves local workspace files once (`resolveLocalWorkspaceFile`) for the app
protocol drag-out route and the clipboard procedures; the renderer adds `DownloadURL` on drag start
and routes Copy/Paste through two host procedures.

**Tech Stack:** Electron `protocol`, `clipboard`, `node:fs/promises`; Wire host contract; React.

**Spec:** `docs/superpowers/specs/2026-10-28-file-tree-finder-transfer-design.md`

## Global Constraints

- Local workspaces only; SSH unchanged. macOS clipboard format `NSFilenamesPboardType`.
- No overwrite on paste; clash → `<name> copy<ext>`, then `<name> copy 2<ext>`…
- Path input from the renderer goes through `parsePortableRelativePath` + workspace realpath.

## Review Focus

1. Protocol route must reject `..`, other workspaces' ids that don't exist, and SSH workspaces.
2. In-tree copy then paste must still use the in-tree flow (OS clipboard equals last tree copy).
3. Drag within the tree / into prompt or terminal must behave as before.

---

### Task 1: Main — resolver, protocol route, clipboard procedures

**Files:** `src/main/core/app/service.ts`, `src/main/core/app/controller.ts`,
`src/main/host/protocol.ts`, `src/core/primitives/desktop-host/api/host-contract.ts`,
`src/main/bootstrap/boot/wiring.ts`.

**Produces:** `appService.resolveLocalWorkspaceFile({workspaceId, relativePath}): Promise<Result<string, ShowWorkspaceItemInFolderError>>`;
host procedures `clipboardWriteFiles({paths: string[]})`, `clipboardReadFiles(): {success, paths}`,
`pasteFilesIntoWorkspace({workspaceId, relativeDir, sources: string[]}): {success, error?}`.

- [ ] Extract the resolver from `showWorkspaceItemInFolder`; it calls the resolver.
- [ ] `/__workspace-file/<id>/<rel>` in the app protocol → `net.fetch(file URL)` of the resolved path.
- [ ] Clipboard write/read with a plist of `<string>` paths; paste copies with `cp` (recursive, `errorOnExist`, `force: false`).

### Task 2: Renderer — drag-out URL and Copy/Paste

**Files:** `src/core/features/editor/contributions/browser/editor-file-tree.tsx`, `src/core/primitives/desktop-host/browser/host-client.ts` (only if a helper is needed).

- [ ] `onDragStart`: local workspace + first file → `dataTransfer.setData('DownloadURL', …)`.
- [ ] `copySelection`: local → `clipboardWriteFiles(paths)`.
- [ ] `pasteInto`: local → `clipboardReadFiles`; if paths differ from last tree copy → `pasteFilesIntoWorkspace`, refresh; else existing flow. Paste enabled for local workspaces.

### Task 3: Verify

- [ ] Typecheck; protocol/service unit tests still pass; manual: drag to Desktop, copy→Finder paste, Finder copy→tree paste.
