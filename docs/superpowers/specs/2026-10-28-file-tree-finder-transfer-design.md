# File tree ⇄ Finder transfer — design

## Intent

Dragging a file from the task file tree onto Finder/Desktop creates a text clipping of its path
instead of the file. Copy in the tree cannot be pasted in Finder, and files copied in Finder cannot
be pasted into the tree. The user wants all three, like VS Code (both copy/paste directions).

## Decisions

- **Drag out (local workspaces, one file):** keep the HTML drag that in-app targets rely on (tree
  moves, prompt and terminal drops via `setDraggedWorkspaceFile`) and add a Chromium `DownloadURL`
  entry, as VS Code does: `application/octet-stream:<name>:app://emdash/__workspace-file/<workspaceId>/<relative path>`.
  Finder receives a file promise and Chromium downloads it from the app protocol. Chromium supports
  a single file per drag and no directories; multi-selection drags out the first file only.
- **App protocol route:** `setupAppProtocol` serves `/__workspace-file/<workspaceId>/<relative>` by
  resolving through `appService.resolveLocalWorkspaceFile` (local workspace only, portable relative
  path, realpath) — the same resolution `showWorkspaceItemInFolder` already uses, extracted.
  Anything else on that prefix is 404/403. The renderer can already read these files over Wire, so
  this grants nothing new.
- **Copy → Finder (macOS):** tree Copy also writes the absolute paths to the OS clipboard as
  `NSFilenamesPboardType` (plist), through a new host procedure `clipboardWriteFiles`.
- **Finder → Paste:** new host procedure `clipboardReadFiles` returns the OS clipboard's file paths.
  Tree Paste prefers them unless they are exactly what the tree itself last copied (then the
  existing in-tree copy/move runs). OS files are copied by main with `fs.cp` (recursive, no
  overwrite) via `pasteFilesIntoWorkspace`; a name clash gets Finder's ` copy` suffix.
- Paste stays enabled for local workspaces even when the tree clipboard is empty, since the OS
  clipboard can only be read asynchronously.
- SSH workspaces keep today's behavior (in-tree only).

## Non-goals

Windows/Linux file clipboard formats, dragging folders or several files out, cut to Finder.
