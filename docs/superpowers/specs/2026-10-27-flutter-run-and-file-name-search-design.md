# Flutter run controls + file-name search in the Files panel

## Intent

The user builds Flutter mobile apps and today switches to VS Code to (1) run the app on an iOS /
Android simulator ("Run Without Debugging") and (2) open Flutter DevTools in Chrome ("Dart: Open
DevTools > Open in Web Browser"). They want both as one-click buttons in the Emdash task titlebar.
They also want the Files panel search to list files by name (like VS Code `Cmd+P`), not only
content matches.

## Flutter run controls

- Shown only when the task workspace has `pubspec.yaml` at its root.
- **Idle:** one **Run** button plus a ▾ device picker.
  - Run uses the last device picked for this project. No remembered device, or it is gone ⇒ the
    picker opens.
  - Picker lists running devices (`flutter devices --machine`, supported only) and offline
    emulators (`flutter emulators`) as "Start <name>". Picking an emulator launches it, waits for a
    new emulator device to appear, then runs on it.
  - Not included (user's call): create emulator, cold boot, enable web/macos.
- **Running:** Run turns into **Stop** (sends `q`) plus **Hot Restart** (sends `R`). DevTools needs
  no button: Emdash's preview-server pill already picks up the URL `flutter run` prints and offers
  Open in Emdash Browser / System Browser (user dropped the Debug button after seeing it).
- Everything runs in one task terminal named "Flutter", created without opening the terminal
  drawer, so logs stay one click away. Closing that terminal or flutter exiting returns to idle.

### How it is built (builder's call)

Renderer only, no new Wire procedures: the existing terminals client (`create`, `sendInput`,
`output` live log) drives a shell in the task worktree. Commands are bracketed by printed markers
(`@@B$((1))_<token>@@`) so their output can be cut out of the stream; the arithmetic keeps the
echoed command line from matching. Requires a POSIX-ish shell (zsh/bash), the macOS default.

## File-name search

Typing in the Files panel search shows file-name matches (existing `searchWorkspaceFiles`, no
ripgrep needed) above the content results. Clicking a file opens it.

## Non-goals

Breakpoints / step debugging inside Emdash (use the DevTools Debugger tab), hot reload button,
SSH-remote Flutter devices.
