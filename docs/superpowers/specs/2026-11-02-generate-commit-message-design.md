# Generate commit message — design

## Goal
Sparkles button in the commit card fills the message input with a message written by the task's
agent CLI, run one-shot (non-interactive) in the task worktree.

## Decisions
- **Which agent**: provider of the task's initial conversation (else first conversation). User chose
  "task's agent" over a fixed `claude -p` or an API key.
- **Where it runs**: host runtime `agentConfig` (has `AgentPluginHost`, exists locally and on the SSH
  workspace-server), so SSH tasks work. Desktop exposes `sourceControl.checkout.generateCommitMessage
  ({ workspaceId, providerId })` and forwards with the resolved worktree path.
- **Plugin surface**: optional `prompt.oneShotArgs(prompt): string[]` behavior. Implemented for
  `claude` (`-p --model haiku`) and `codex` (`exec --skip-git-repo-check`). Others return
  `invalid-state` "<name> does not support commit message generation" (toast).
- **Input**: `git diff --cached` (falls back to `git diff HEAD` when nothing staged — the card stages
  everything in that case), capped at 60k chars (argv limit), plus last 10 commit subjects so the
  message follows the repo's style. Output: CLI stdout trimmed, wrapping code fences stripped.
- **UI**: icon button at the right of the input; spinner while running; disabled while in flight or
  no changes. Error = toast. Does not change any existing commit behaviour.

## Out of scope
Streaming output, provider/model picker, per-provider support beyond claude/codex.
