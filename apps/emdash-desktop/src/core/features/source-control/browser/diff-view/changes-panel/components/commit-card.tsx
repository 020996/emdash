import { Button, Input, SplitButton, toast } from '@emdash/ui/react/primitives';
import { ArrowUp, Loader2, Sparkles, Undo2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { getConversationsForTask } from '@core/features/conversations/api/browser/conversation-selectors';
import {
  checkoutSelector,
  getSourceControlClient,
} from '@core/features/source-control/api/browser/client';
import { getGitRepositoryStore } from '@core/features/source-control/api/browser/stores/source-control-selectors';
import { getTaskGitCheckoutStore } from '@core/features/source-control/api/browser/stores/task-source-control-selectors';
import { formatPushErrorDetail } from '@core/features/source-control/api/git-error-messages';
import { gitCheckoutStoreToken } from '@core/features/source-control/contributions/browser/workspace-store-tokens';
import { formatErrorType } from '@core/features/tasks/api/browser/utils';
import { useTaskViewContext } from '@core/features/tasks/contributions/browser/task-view-context';
import {
  useTaskComposition,
  useWorkspace,
  useWorkspaceId,
} from '@core/features/workbench/api/browser/task-composition-context';
import { useOpenModal } from '@core/manifests/browser/modal-api';

type CommitPhase = 'idle' | 'committing' | 'pushing' | 'opening-pr';

/** Pinned above the change sections; with nothing staged, committing stages everything. */
export const CommitCard = observer(function CommitCard() {
  const { projectId, taskId } = useTaskViewContext();
  const workspaceId = useWorkspaceId();
  const taskView = useTaskComposition();
  const workspace = useWorkspace();
  const git = workspace.get(gitCheckoutStoreToken);
  const diffView = taskView.diffView;
  const changesView = diffView?.changesView ?? null;
  const hasPRs = changesView?.expandedSections.pullRequests ?? false;
  const [commitMessage, setCommitMessage] = useState('');
  const [phase, setPhase] = useState<CommitPhase>('idle');
  const [generating, setGenerating] = useState(false);
  /** Thrown errors (model not ready, job failure) would otherwise leave the card stuck in flight. */
  const guarded = (work: () => Promise<void>) => () =>
    void work().catch((error: unknown) => {
      toast.error(`Git action failed: ${error instanceof Error ? error.message : String(error)}`);
      setPhase('idle');
    });
  const autoStage = git.stagedFileChanges.length === 0;
  const isInFlight = phase !== 'idle';

  const openCreatePrModal = useOpenModal('createPrModal');
  const repository = getGitRepositoryStore(projectId);
  const repositoryUrl = repository?.pullRequestRepositoryUrl ?? null;

  if (!diffView || !changesView) return null;
  const branchName = getTaskGitCheckoutStore(projectId, taskId)?.branchName;
  const hasOpenPr = taskView.prStore?.pullRequests.some((p) => p.status === 'open') ?? false;
  const canCreatePr =
    repository?.providerRepository?.capabilities.pullRequests &&
    Boolean(repositoryUrl) &&
    Boolean(branchName) &&
    !hasOpenPr;

  const stageAllIfNeeded = async (): Promise<boolean> => {
    if (!autoStage) return true;
    changesView.suppressNextAutoExpand('staged');
    const result = await git.stageAllFiles();
    if (!result.success) {
      toast.error(`Failed to stage changes: ${formatErrorType(result.error)} `);
      setPhase('idle');
      return false;
    }
    return true;
  };

  const doCommit = async () => {
    setPhase('committing');
    if (!(await stageAllIfNeeded())) return;
    const result = await git.commit(commitMessage);
    if (!result.success) {
      toast.error(`Failed to commit changes: ${formatErrorType(result.error)} `);
      setPhase('idle');
      return;
    }
    setCommitMessage('');
    if (!autoStage) {
      changesView.setExpanded({ unstaged: true, staged: false, pullRequests: hasPRs });
    }
    // No "Committed" flash: the card swaps straight to the Push button.
    setPhase('idle');
  };

  /** Soft reset: the commit's changes return staged and its message refills the input. */
  const doUndo = async () => {
    const result = await git.undoLastCommit();
    if (!result.success) {
      toast.error(`Failed to undo commit: ${formatErrorType(result.error)}`);
      return;
    }
    setCommitMessage(result.data.message);
  };
  // ponytail: only unpushed commits, so undo never rewrites what the remote already has.
  const undoButton = git.aheadCount > 0 && (
    <Button
      variant="ghost"
      size="xs"
      aria-label="Undo last commit"
      title="Undo last commit"
      disabled={isInFlight || generating}
      onClick={guarded(doUndo)}
    >
      <Undo2 className="size-3.5" />
    </Button>
  );

  /** The task's agent writes the message: its first conversation's provider, run one-shot. */
  const generateMessage = async () => {
    const conversations = [...(getConversationsForTask(taskId)?.conversations.values() ?? [])];
    const providerId = (conversations.find((c) => c.isInitialConversation) ?? conversations[0])
      ?.data.providerId;
    if (!providerId) {
      toast.error('Start an agent in this task to generate a commit message');
      return;
    }
    setGenerating(true);
    try {
      const client = await getSourceControlClient();
      const result = await client.checkout.generateCommitMessage({
        ...checkoutSelector(workspaceId),
        providerId,
      });
      if (!result.success) {
        const { error } = result;
        toast.error(
          `Failed to generate commit message: ${'message' in error ? error.message : error.type}`
        );
        return;
      }
      setCommitMessage(result.data.message);
    } catch (error) {
      toast.error(
        `Failed to generate commit message: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const doPush = async () => {
    setPhase('pushing');
    const pushResult = await git.push();
    if (!pushResult.success) {
      toast.error(`Failed to push: ${formatPushErrorDetail(pushResult.error)}`);
      setPhase('idle');
      return;
    }
    // No "Pushed" flash: nothing left ahead hides the card.
    setPhase('idle');
  };

  const doCommitAndCreatePr = async () => {
    setPhase('committing');
    if (!(await stageAllIfNeeded())) return;
    const commitResult = await git.commit(commitMessage);
    if (!commitResult.success) {
      toast.error(`Failed to commit changes: ${formatErrorType(commitResult.error)} `);
      setPhase('idle');
      return;
    }
    setCommitMessage('');
    if (!autoStage) {
      changesView.setExpanded({ unstaged: true, staged: false, pullRequests: hasPRs });
    }
    setPhase('opening-pr');
    await new Promise((r) => setTimeout(r, 500));
    setPhase('idle');
    void openCreatePrModal({
      projectId,
      taskId,
      repositoryUrl: repositoryUrl ?? '',
      branchName: branchName ?? '',
      draft: false,
      workspaceId,
    });
  };

  if (autoStage && !git.unstagedFileChanges.length) {
    if (git.aheadCount === 0 && phase === 'idle') return null;
    return (
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-3 pt-2 pb-3">
        <div className="flex items-center gap-1">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            disabled={isInFlight}
            onClick={guarded(doPush)}
          >
            {phase === 'pushing' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
            Push {git.aheadCount} {git.aheadCount === 1 ? 'commit' : 'commits'}
          </Button>
          {undoButton}
        </div>
      </div>
    );
  }

  const actions = [
    { id: 'commit', label: 'Commit', action: guarded(doCommit) },
    ...(canCreatePr
      ? [
          {
            id: 'commit-pr',
            label:
              repository?.providerRepository?.provider === 'gitlab'
                ? 'Commit & Create MR'
                : 'Commit & Create PR',
            action: guarded(doCommitAndCreatePr),
          },
        ]
      : []),
  ];

  // A saved 'commit-push' preference (option removed) or unavailable PR falls back to Commit.
  const effectiveAction = actions.some((a) => a.id === diffView.effectiveCommitAction)
    ? diffView.effectiveCommitAction
    : 'commit';

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-3 pt-2 pb-3">
      <div className="flex items-center gap-1">
        <Input
          placeholder="Message (⌘Enter to commit)"
          className="w-full"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || !commitMessage.trim()) return;
            e.preventDefault();
            actions.find((a) => a.id === effectiveAction)?.action();
          }}
          disabled={isInFlight || generating}
        />
        <Button
          variant="ghost"
          size="xs"
          aria-label="Generate commit message"
          title="Generate commit message"
          disabled={isInFlight || generating}
          onClick={() => void generateMessage()}
        >
          {generating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
        </Button>
        {undoButton}
      </div>
      {actions.length === 1 && (
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          disabled={!commitMessage.trim() || isInFlight}
          onClick={actions[0].action}
        >
          {phase === 'committing' && <Loader2 className="size-3.5 animate-spin" />}
          Commit
        </Button>
      )}
      {phase === 'idle' && actions.length > 1 && (
        <SplitButton
          options={actions.map(({ id, label }) => ({ id, label }))}
          size="sm"
          fullWidth
          disabled={!commitMessage.trim()}
          selectedId={effectiveAction}
          onSelectedChange={(id) =>
            diffView.setCommitAction(id as 'commit' | 'commit-push' | 'commit-pr')
          }
          commitOnSelect={false}
          onAction={(id) => actions.find((a) => a.id === id)?.action()}
        />
      )}
      {phase === 'committing' && actions.length > 1 && (
        <StatusRow icon={<Loader2 className="size-4 animate-spin" />} label="Committing…" />
      )}
      {phase === 'opening-pr' && (
        <StatusRow
          icon={<Loader2 className="size-4 animate-spin" />}
          label={
            repository?.providerRepository?.provider === 'gitlab' ? 'Opening MR…' : 'Opening PR…'
          }
        />
      )}
    </div>
  );
});

function StatusRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex w-full items-center justify-center gap-2 py-1 text-sm text-foreground-muted">
      {icon}
      <span>{label}</span>
    </div>
  );
}
