# Plan: Flutter run controls + file-name search

Spec: `docs/superpowers/specs/2026-10-27-flutter-run-and-file-name-search-design.md`

1. `tasks/browser/flutter/flutter-output.ts` — pure parsers: strip ANSI, cut marker-bracketed
   output, parse `flutter devices --machine` JSON and `flutter emulators` table. Test:
   `flutter-output.test.ts`.
2. `tasks/browser/flutter/flutter-runner.ts` — MobX store per task: owns the "Flutter" terminal,
   `exec()` for marker-bracketed commands, `run(device)`, `stop()`, `hotRestart()`,
   `detectFlutter()`; remembers the last device per project in localStorage.
3. `tasks/browser/flutter/flutter-run-controls.tsx` — titlebar buttons + device picker
   (DropdownMenu); mount in `task-titlebar.tsx` before `OpenInMenu`.
4. `editor/browser/task-editor/file-name-search-results.tsx` — debounced `searchWorkspaceFiles`,
   list with `FileIcon`, click ⇒ `openFile`; render above `FileContentSearchResults` in
   `editor-file-tree.tsx`.
5. Gate: typecheck, lint, format, focused tests; run dev for manual check.
