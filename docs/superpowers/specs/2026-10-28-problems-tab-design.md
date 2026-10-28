# Problems tab — design

## Intent

The user wants a VS Code-style **Problems** tab in the task's bottom drawer, at the same level as
Terminals (the drawer's `Terminals | Scripts` switcher). It lists editor diagnostics grouped by file;
clicking one opens the file at that position.

## Decisions

- **Placement:** a third drawer mode `problems` next to `terminals` / `scripts` in
  `TerminalDrawerTabBar`, with a count badge when there are problems.
- **Source:** Monaco markers (`monaco.editor.getModelMarkers`) — already fed by the LSP host and the
  local fallback through `ModelDiagnostics`. Live via `onDidChangeMarkers`.
- **Scope:** the whole workspace, like VS Code (user decision). The LSP host keeps
  `publishDiagnostics` for files that are not open (workspace-analysing servers such as Dart report
  the entire project); the panel reads the attached servers' diagnostics under the task root, and
  open files use their live Monaco markers instead. A server starts when the first file of its
  language is opened.
- **Servers added:** Dart (`dart language-server --protocol=lsp`, root `pubspec.yaml`) and PHP
  (Intelephense, `--stdio`, root `composer.json`). JavaScript was already covered by the bundled
  TypeScript server.
- **Task filter:** a marker belongs to the task when its model URI decodes (`decodeFacetUri`) to a ref
  registered for that task through `registerLanguageContext` (every file tab registers one).
- **Row:** severity icon, message, `source(code)`, `[Ln x, Col y]`; files show name + directory
  relative to the workspace root, with a count; sorted errors first, then line.
- **Open:** same path as LSP go-to-definition (`openFile` + `requestSelection`), extracted into a
  shared `openEditorLocation`.
- Terminals stay mounted while Problems is shown (the panel overlays the PTY area) so xterm keeps its
  size and sessions.

## Non-goals

Filtering/search box, quick fixes, starting servers before any file is opened.
