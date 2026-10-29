# Terminal drawer split — design

## Intent

User wants VS Code-style split terminal in the bottom terminal drawer: several terminals side by
side in one view, each with its own shell.

## Behavior (VS Code parity, scoped)

- Split button (columns icon) next to the `+` in the drawer tab bar, tooltip
  "Split terminal ⌘\".
- `⌘\` (`workbench.splitPane`) while the drawer is focused splits the active terminal.
- Split = create a new terminal and add it to the active terminal's group, right after it.
- Selecting any tab of a group shows the whole group side by side; the selected one is the
  focused pane (highlighted tab, auto-focus).
- Clicking inside a pane makes it the active terminal.
- Panes are separated by draggable `Resizable.Handle`s; sizes start even and are not persisted.
- Closing a terminal removes it from its group; a group of one becomes a normal terminal.
- Group members stay adjacent in the tab order.
- Right-click a terminal tab: "Join into split" lists terminals outside its group (joins that
  terminal right after it); "Unsplit terminal" takes it out of its group; "Close terminal".
- Drag a drawer terminal tab onto a drawer terminal pane: joins it into that pane's split, right
  after it (right-half highlight while hovering). Dropping on the main area still moves it there.
- Groups persist across reloads (task terminal-selection memento).

## Non-goals

- Vertical (top/bottom) split, group-level tabs like VS Code's
  tree list, persisted pane sizes.

## Decisions (builder calls)

- State: optional `splits: string[][]` on `taskTerminalSelection` v1 memento (optional field,
  old data still parses; no version bump). Only groups of 2+ stored.
- Pure helpers in `terminal-splits.ts` (`splitGroupOf`, `addToSplit`, `pruneSplits`) + unit test.
- Each pane renders its own `TerminalPtyContent` (own dimension sink / resize controller). The
  first pane also drives background (hidden) sessions, matching today's single-pane behavior.
- Terminals moved into a main pane are excluded from the drawer group view.
