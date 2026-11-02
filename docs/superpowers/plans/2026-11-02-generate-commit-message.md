# Generate commit message — plan

1. `packages/core/.../capabilities/prompt.ts`: add optional `oneShotArgs` to the prompt behavior.
2. `packages/plugins/.../claude/index.ts`, `codex/index.ts`: implement `oneShotArgs`.
3. `packages/core/src/runtimes/agent-config/node/runtime/commit-message.ts`: `buildCommitMessagePrompt`
   (pure, unit tested) + `generateCommitMessage(agentHost, providerId, cwd)` (git diff/log + CLI exec).
4. agent-config contract/procedures/runtime: `generateCommitMessage` fallible procedure
   (`{ providerId, cwd: hostAbsolutePath }` -> `{ message }`, auth error union).
5. Desktop `source-control/api/contract.ts` + `node/wire-controller.ts`: workspace-keyed procedure
   forwarding through `withIdentityRuntime` to `client.agentConfig.generateCommitMessage`.
6. `commit-card.tsx`: Sparkles button, provider from task conversations, toast on error.
7. Verify: vitest (prompt builder), oxfmt/oxlint, per-file typecheck.
