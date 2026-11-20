# Task list: conversation dropdown + auto conversation titles

Date: 2026-10-26
Status: draft, awaiting approval

## Intent

The project task list (`ProjectView → Tasks`) shows one row per task. A task often holds
several agent conversations (Claude, Codex, …), but from the list you cannot see them, and
inside the task they are named `Claude (1)`, `Claude (2)` — you must open each to learn
what it was about. The user also lost track of a conversation after closing its tab and
thought the history was gone.

Goal: from the task list, see every conversation of a task with a meaningful name, and
open any of them (with full history) in one click. Names are produced automatically from
the conversation itself, the way Warp names terminal tabs (`✳ History-video continuation`)
— the user does not rename anything.

## Goals

1. Each task row in the project task list gets an expand chevron (▸/▾). Expanded, it
   lists that task's conversations underneath, indented.
2. Each conversation row shows: agent icon, display title, status indicator (working /
   awaiting input / done) or relative last-interaction time when idle — same visual
   language as `SidebarConversationsList`'s `ConversationRow`.
3. Clicking a conversation row navigates to the task and opens that conversation's tab
   (non-preview), including conversations whose tab was closed. History comes from the
   existing resume path (TUI `--resume`, ACP transcript); nothing new is needed for it.
4. Conversations get automatic titles, for every agent where a signal exists:
   1. **Terminal title set by the agent** (OSC 0 / OSC 2 escape in PTY output). Claude Code
      emits this (it is the same text as the `ai-title` entry in its transcript, e.g.
      `Kiểm thử phần mềm mới`). Other TUI agents that set a terminal title get it for free.
   2. **First user prompt** when no terminal title is available:
      - ACP conversations: first user message.
      - TUI conversations: the `initialPrompt` passed at task/conversation creation, if any.
      Truncated to a readable length (≈50 chars, word boundary) and capped by
      `MAX_CONVERSATION_TITLE_LENGTH`.
   3. Otherwise keep today's default `Claude (1)` / `Codex (2)`.
5. Auto titles keep updating while the conversation runs (Claude refines its title as the
   topic changes), so the latest agent-provided title wins over earlier ones.

## Non-goals

- Reading what the user types directly into a TUI terminal to derive a title (unreliable,
  security-sensitive PTY path).
- Generating titles with an extra LLM call.
- Per-agent transcript parsers (e.g. reading `~/.claude/projects/*.jsonl`). The terminal
  title is the generic channel; transcript parsing is out unless OSC proves insufficient.
- Changing the in-task right-sidebar Conversations list beyond it naturally showing the
  new titles.
- Left app sidebar (project/task tree) changes.

## Anti-goals (would count as failure even if it "works")

- Overwriting a title the user renamed manually. Manual rename always wins and is never
  replaced by an auto title afterwards.
- Titles containing spinner/status glyphs or control characters (`✳`, braille spinner
  frames `⠂⠐…`, ANSI codes). Strip leading glyphs/whitespace.
- Titles that are just the agent's product name or a path (`Claude Code`, `claude`,
  `~/Documents/...`, `..y/mobile-admin-shopify`) — these carry no information; ignore them.
- Title churn: writing to the DB on every PTY chunk. Only persist when the cleaned title
  actually changes, and debounce.
- Weakening PTY handling: parsing must be read-only on the output stream and must not
  alter bytes delivered to the terminal.
- Making the task list slow: rows are expanded by default, so conversation data for
  visible tasks must be cheap to load (batch per project, e.g. `getConversationsForProject`,
  rather than one request per task) and collapsed rows must not fetch.

## Constraints

- Follow `AGENTS.md`: Wire contracts for renderer↔main, MobX selectors
  (`getTaskStore`, `conversationRegistry`, …), oxfmt/oxlint, strict TS, Vitest tests.
- PTY / `packages/core/src/runtimes/tui-agents/` is a high-risk area — read
  `agents/risky-areas/pty.md` before touching it.
- Prefer no DB schema migration. If tracking "manually renamed vs auto" truly needs
  persistence, a migration must go through `pnpm run db:generate` (never hand-edited),
  with fixtures/migration tests updated.
- Reuse existing pieces: `renameConversation` persistence path,
  `formatConversationTitleForDisplay`, `ConversationAgentIcon`, `AgentStatus`,
  `RelativeTime`, `conversationTabKind`, `getTaskComposition(...).paneLayout.open(...)` +
  `navigate(taskViewDef(...))` (pattern already used by
  `conversation-palette-provider.tsx`).

## Decisions made

- Dropdown default state: **expanded** (user: a task has few conversations). The user can
  collapse a task; that choice may be remembered per task for the session.
- Auto titles cover all agents through generic channels (OSC title → first prompt →
  default), not Claude-only. (User: "whatever is supported, use it.")
- Manual rename wins permanently (Claude's call, consistent with user not wanting to
  rename but not wanting their edits lost either).

- tmux-backed sessions (tmux is off by default, opt-in per project) get only the
  first-prompt fallback: tmux swallows OSC title escapes and changing tmux config is
  high-risk PTY work. (Claude's call.)
- "Manually renamed" is persisted so both rules hold across app restarts: a flag in the
  conversation's versioned `config` JSON column (schema version bump, no DB migration).
  Auto titles update only while the flag is unset; `renameConversation` from the UI sets
  it. (Claude's call.)

- Scope: **local machine only** (user). Conversations on remote SSH hosts keep today's
  titles; no new host↔client wire field is needed.

## Left to the builder

- Where OSC title parsing lives (likely alongside `onData` in
  `packages/core/src/runtimes/tui-agents/node/runtime/runtime.ts`, feeding agent state or
  a new typed event) and how it reaches the conversation title in the desktop app.
- How "manually renamed" is tracked (e.g. only auto-overwrite when the current title is a
  default `Provider (n)` title or equals the last auto title; or a persisted flag).
- How to load conversations for a task whose `conversationRegistry` manager is not loaded
  yet (e.g. `getConversationsForTask` on expand), and how to open the tab when
  `getTaskComposition` is not mounted yet at click time (navigate first, then open once
  composition exists).
- Debounce interval, truncation details, exact glyph-strip regex.
- Keyboard accessibility of the chevron and conversation rows (must be operable by
  keyboard; exact keys up to the builder).
- Tests: unit tests for title cleaning/extraction and the overwrite rule; a component test
  for expand → list → click opens the conversation.
