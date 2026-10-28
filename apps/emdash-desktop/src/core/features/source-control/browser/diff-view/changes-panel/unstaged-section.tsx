import type { GitChange } from '@emdash/core/runtimes/git/api';
import { EmptyState } from '@emdash/ui/react/components';
import { toast } from '@emdash/ui/react/primitives';
import { Plus, Undo2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { gitCheckoutStoreToken } from '@core/features/source-control/contributions/browser/workspace-store-tokens';
import { formatErrorType } from '@core/features/tasks/api/browser/utils';
import {
  useTaskComposition,
  useWorkspace,
} from '@core/features/workbench/api/browser/task-composition-context';
import { useOpenModal } from '@core/manifests/browser/modal-api';
import { HEAD_REF } from '@core/primitives/git/api';
import { commitRef } from '@core/primitives/git/api';
import { activeDiffEntry } from '../pane-selectors';
import { RowAction } from './components/changes-list-item';
import { ChangesListOrTree } from './components/changes-list-or-tree';
import { ChangesViewModeToggle } from './components/changes-view-mode-toggle';
import { SectionHeader } from './components/section-header';
import { useChangesViewMode } from './hooks/use-changes-view-mode';
import { usePrefetchDiffModels } from './hooks/use-prefetch-diff-models';

/** Always-visible header row; rendered as a direct child of the sections group. */
export const UnstagedSectionHeader = observer(function UnstagedSectionHeader() {
  const taskView = useTaskComposition();
  const workspace = useWorkspace();
  const git = workspace.get(gitCheckoutStoreToken);
  const changesView = taskView.diffView?.changesView;
  const { mode: viewMode, setMode: setViewMode } = useChangesViewMode('unstaged');
  const openConfirmActionModal = useOpenModal('confirmActionModal');

  if (!changesView) return null;

  const handleDiscardAll = () => {
    void (async () => {
      const outcome = await openConfirmActionModal({
        title: 'Discard All Changes',
        variant: 'destructive',
        description: 'Are you sure you want to discard all changes? This can not be undone.',
      });
      if (!outcome.success) return;

      const result = await git.discardAllFiles();
      if (!result.success) {
        toast.error(`Failed to discard changes: ${formatErrorType(result.error)} `);
      }
    })();
  };

  const handleStageAll = () => {
    void git.stageAllFiles().then((result) => {
      if (!result.success) {
        toast.error(`Failed to stage changes: ${formatErrorType(result.error)} `);
      }
    });
  };

  return (
    <SectionHeader
      label="Changed"
      collapsed={!changesView.expandedSections.unstaged}
      onToggleCollapsed={() => changesView.toggleExpanded('unstaged')}
      count={git.unstagedFileChanges.length}
      actions={
        <>
          {git.unstagedFileChanges.length > 0 && (
            <>
              <RowAction title="Discard all changes" onClick={handleDiscardAll}>
                <Undo2 className="size-3.5" />
              </RowAction>
              <RowAction title="Stage all changes" onClick={handleStageAll}>
                <Plus className="size-3.5" />
              </RowAction>
            </>
          )}
          <ChangesViewModeToggle value={viewMode} onChange={setViewMode} label="Changed" />
        </>
      }
    />
  );
});

/** Section body; mounted inside a Resizable.Panel only while the section is expanded. */
export const UnstagedSectionBody = observer(function UnstagedSectionBody() {
  const taskView = useTaskComposition();
  const workspace = useWorkspace();
  const git = workspace.get(gitCheckoutStoreToken);
  const diffView = taskView.diffView;
  const changesView = diffView?.changesView;

  const changes = git.unstagedFileChanges;
  const hasChanges = changes.length > 0;

  const _activeDiff = activeDiffEntry(taskView.activePane);
  const activePath = _activeDiff?.diffGroup === 'disk' ? _activeDiff.path : undefined;

  const prefetch = usePrefetchDiffModels('disk', HEAD_REF);

  const { mode: viewMode } = useChangesViewMode('unstaged');

  const openConfirmActionModal = useOpenModal('confirmActionModal');

  if (!diffView || !changesView) return null;

  const handleSelectChange = (change: GitChange) => {
    taskView.activePane.open(
      'diff',
      {
        activeFile: {
          path: change.path,
          type: 'disk',
          group: 'disk',
          originalRef: commitRef('HEAD'),
        },
        status: change.status,
      },
      { preview: true }
    );
  };

  const handleDoubleClickChange = (change: GitChange) => {
    taskView.activePane.open(
      'diff',
      {
        activeFile: {
          path: change.path,
          type: 'disk',
          group: 'disk',
          originalRef: commitRef('HEAD'),
        },
        status: change.status,
      },
      { preview: false }
    );
  };

  const discardPath = (path: string) => {
    void (async () => {
      const outcome = await openConfirmActionModal({
        title: 'Discard Files Changes',
        variant: 'destructive',
        description: `Are you sure you want to discard the changes to ${path}? This can not be undone.`,
      });
      if (!outcome.success) return;

      const result = await git.discardFiles([path]);
      if (!result.success) {
        toast.error(`Failed to discard changes: ${formatErrorType(result.error)} `);
        return;
      }
    })();
  };

  const stagePath = (path: string) => {
    void git.stageFiles([path]).then((result) => {
      if (!result.success) {
        toast.error(`Failed to stage changes: ${formatErrorType(result.error)} `);
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!hasChanges && (
        <EmptyState label="Working tree clean" description="No uncommitted file changes." />
      )}
      <div className="min-h-0 flex-1 px-1">
        <ChangesListOrTree
          viewMode={viewMode}
          changes={changes}
          rootPath={workspace.path}
          activePath={activePath}
          onSelectChange={handleSelectChange}
          onDoubleClickChange={handleDoubleClickChange}
          onPrefetch={(change) => prefetch(change.path)}
          rowActions={(change) => (
            <>
              <RowAction title="Discard changes" onClick={() => discardPath(change.path)}>
                <Undo2 className="size-3.5" />
              </RowAction>
              <RowAction title="Stage changes" onClick={() => stagePath(change.path)}>
                <Plus className="size-3.5" />
              </RowAction>
            </>
          )}
        />
      </div>
    </div>
  );
});
