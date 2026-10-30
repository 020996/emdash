import { Button, Combobox, toast, Tooltip } from '@emdash/ui/react/primitives';
import { ArrowDown, ArrowUp, GitBranch, RefreshCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import {
  asAvailableProject,
  getProjectStore,
  projectDisplayName,
} from '@core/features/projects/api/browser/stores/project-selectors';
import { getGitRepositoryStore } from '@core/features/source-control/api/browser/stores/source-control-selectors';
import { getTaskGitCheckoutStore } from '@core/features/source-control/api/browser/stores/task-source-control-selectors';
import { useGitActions } from '@core/features/source-control/api/browser/use-git-actions';
import { formatSwitchBranchErrorDetail } from '@core/features/source-control/api/git-error-messages';
import { BranchSelector } from '@core/features/source-control/browser/components/branch-selector';
import {
  getBranchTooltipText,
  getPublishTooltipText,
} from '@core/features/source-control/browser/diff-view/changes-panel/git-status-tooltips';
import { getTaskStore } from '@core/features/tasks/api/browser/task-state/task-selectors';
import { useTaskViewContext } from '@core/features/tasks/contributions/browser/task-view-context';
import { useOpenModal } from '@core/manifests/browser/modal-api';
import { projectAvailabilityUi } from '@core/manifests/browser/project-availability-ui';

/** Branch + sync row pinned under every task sidebar tab; `extra` sits right after the branch. */
export const GitStatusSection = observer(function GitStatusSection({
  extra,
}: {
  extra?: React.ReactNode;
}) {
  const { projectId, taskId } = useTaskViewContext();
  const workspaceId = getTaskStore(projectId, taskId)?.workspaceId;
  const git = getTaskGitCheckoutStore(projectId, taskId);
  const headDisplay = git?.headDisplay ?? null;
  const headKind = git?.headKind ?? 'branch';
  const isDetached = headKind === 'detached';
  const project = getProjectStore(projectId);
  const projectName = projectDisplayName(project) ?? 'repository';
  const context = asAvailableProject(project);
  const hostActionReason = context
    ? projectAvailabilityUi.getLiveActionDisabledReason(projectId)
    : 'Unavailable until access to this Project is restored.';
  const hostActionDisabled = hostActionReason !== null;
  const repositoryStore = getGitRepositoryStore(projectId);
  const openAddRemoteModal = useOpenModal('addRemoteModal');
  const [branchPickerKey, setBranchPickerKey] = useState(0);

  const {
    isPublished,
    aheadCount,
    behindCount,
    fetch,
    pull,
    push,
    publish,
    isPublishing,
    isFetching,
    isPulling,
    isPushing,
  } = useGitActions(projectId, taskId);
  const shouldOfferAddRemote = (repositoryStore?.remotes.length ?? 0) === 0;

  const handlePublishClick = () => {
    if (hostActionDisabled || !headDisplay || headKind !== 'branch' || !workspaceId) return;
    if (shouldOfferAddRemote) {
      void openAddRemoteModal({
        projectId,
        projectName,
        workspaceId,
      });
      return;
    }
    publish();
  };

  return (
    <Tooltip.Provider>
      <div className="flex flex-col gap-2 border-t border-border p-2">
        <div className="flex items-center justify-between gap-2 text-foreground-muted">
          <div className="flex min-w-0 items-center gap-3">
            <BranchSelector
              // Remount after a failed switch: the picker already ticked the clicked branch.
              key={branchPickerKey}
              branches={repositoryStore?.branchRefs ?? []}
              value={git?.branchName ? { type: 'local', branch: git.branchName } : undefined}
              onValueChange={(branch) => {
                if (!git || branch.branch === git.branchName) return;
                const fail = (detail: string) => {
                  setBranchPickerKey((key) => key + 1);
                  toast.error(`Can't switch to ${branch.branch}: ${detail}`);
                };
                git.switchBranch(branch.branch).then(
                  (result) => {
                    if (result.success) toast.success(`Switched to ${branch.branch}`);
                    else fail(formatSwitchBranchErrorDetail(branch.branch, result.error));
                  },
                  (error: unknown) => fail(error instanceof Error ? error.message : String(error))
                );
              }}
              branchLabelRemote="full"
              contentClassName="w-96!"
              onRefresh={() => repositoryStore?.refresh()}
              isRefreshing={repositoryStore?.loading ?? false}
              observationKind={repositoryStore?.refsObservation.kind ?? 'unavailable'}
              trigger={
                <Combobox.Trigger
                  title={getBranchTooltipText(headDisplay, headKind)}
                  disabled={hostActionDisabled}
                  className="flex min-w-0 items-center gap-2 rounded-sm hover:text-foreground"
                >
                  <GitBranch className="size-3 shrink-0" />
                  <span className="truncate text-xs">{headDisplay}</span>
                </Combobox.Trigger>
              }
            />
            <div className="flex items-center gap-1">
              {isPublished && !isDetached ? (
                <>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="secondary"
                          size="xs"
                          icon
                          disabled={isFetching}
                          aria-disabled={hostActionDisabled}
                          aria-description={hostActionReason ?? undefined}
                          onClick={() => {
                            if (!hostActionDisabled) fetch();
                          }}
                        >
                          <RefreshCcw className="size-3" />
                        </Button>
                      }
                    />
                    <Tooltip.Content>
                      {hostActionReason ?? (isFetching ? 'Fetching...' : 'Fetch changes')}
                    </Tooltip.Content>
                  </Tooltip.Root>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={behindCount === 0}
                          disabled={isPulling || behindCount === 0}
                          aria-disabled={hostActionDisabled}
                          aria-description={hostActionReason ?? undefined}
                          onClick={() => {
                            if (!hostActionDisabled) pull();
                          }}
                        >
                          <ArrowDown className="size-3" />
                          {behindCount > 0 && <span className="tabular-nums">{behindCount}</span>}
                        </Button>
                      }
                    />
                    <Tooltip.Content>
                      {hostActionReason ??
                        (isPulling
                          ? 'Pulling...'
                          : behindCount === 0
                            ? 'Nothing to pull'
                            : 'Pull changes')}
                    </Tooltip.Content>
                  </Tooltip.Root>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={aheadCount === 0}
                          disabled={isPushing || aheadCount === 0}
                          aria-disabled={hostActionDisabled}
                          aria-description={hostActionReason ?? undefined}
                          onClick={() => {
                            if (!hostActionDisabled) push();
                          }}
                        >
                          <ArrowUp className="size-3" />
                          {aheadCount > 0 && <span className="tabular-nums">{aheadCount}</span>}
                        </Button>
                      }
                    />
                    <Tooltip.Content>
                      {hostActionReason ??
                        (isPushing
                          ? 'Pushing...'
                          : aheadCount === 0
                            ? 'Nothing to push'
                            : 'Push changes')}
                    </Tooltip.Content>
                  </Tooltip.Root>
                </>
              ) : (
                !isDetached && (
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="secondary"
                          size="xs"
                          disabled={isPublishing || !headDisplay || headKind !== 'branch'}
                          aria-disabled={hostActionDisabled}
                          aria-description={hostActionReason ?? undefined}
                          onClick={handlePublishClick}
                        >
                          <ArrowUp className="size-3" />
                          {isPublishing
                            ? 'Publishing...'
                            : shouldOfferAddRemote
                              ? 'Add Remote'
                              : 'Publish'}
                        </Button>
                      }
                    />
                    <Tooltip.Content>
                      {hostActionReason ??
                        getPublishTooltipText({
                          isPublishing,
                          headDisplay,
                          headKind,
                          shouldOfferAddRemote,
                        })}
                    </Tooltip.Content>
                  </Tooltip.Root>
                )
              )}
            </div>
          </div>
          {extra}
        </div>
      </div>
    </Tooltip.Provider>
  );
});
