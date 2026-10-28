import { AgentStatus } from '@emdash/ui/react/components';
import { RelativeTime } from '@emdash/ui/react/primitives';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { StackedAgentLogos } from '@core/features/agents/contributions/browser/stacked-agent-logos';
import {
  taskAgentStatus,
  taskConversationStats,
} from '@core/features/conversations/api/browser/conversation-selectors';
import {
  getTaskGitCheckoutStore,
  getTaskPrAssociationStore,
} from '@core/features/source-control/api/browser/stores/task-source-control-selectors';
import { getTaskManagerStore } from '@core/features/tasks/api/browser/task-state/task-selectors';
import { TaskContextMenu } from '@core/features/tasks/contributions/browser/task-context-menu';
import { TaskGitDiffStats } from '@core/features/tasks/contributions/browser/task-git-diff-stats';
import { getTaskDisplayName } from '@core/features/workbench/api/browser/task-composition-selectors';
import { useOpenModal } from '@core/manifests/browser/modal-api';
import { cn } from '@core/primitives/styling/browser/cn';
import { selectCurrentPr } from '@root/src/core/services/pull-requests/api';
import { PrBadge } from '@root/src/core/services/pull-requests/browser/components/pr-badge';
import { type ReadyTask } from './task-list-model';

/**
 * Row content for the project task list. The CollectionView shell owns row
 * click (navigation) and modifier-click selection; this component renders the
 * content, the hover-revealed row actions, and the context menu.
 */
export const TaskRow = observer(function TaskRow({ task }: { task: ReadyTask }) {
  const openDeleteTask = useOpenModal('deleteTaskModal');
  const taskManager = getTaskManagerStore(task.data.projectId);

  const handleArchive = () => void taskManager?.archiveTask(task.data.id);
  const handleRestore = () => void taskManager?.restoreTask(task.data.id);
  const handleDelete = () => {
    void openDeleteTask({
      projectId: task.data.projectId,
      tasks: [{ taskId: task.data.id, taskName: task.data.name }],
    }).then((outcome) => {
      if (!outcome.success) return;
      const { deleteWorktree, deleteBranch, deleteConversations } = outcome.data;
      void taskManager?.deleteTasks([task.data.id], {
        deleteWorktree,
        deleteBranch,
        deleteConversations,
      });
    });
  };
  const isArchived = Boolean(task.data.archivedAt);
  const canPin = task.state !== 'unregistered';
  const agentAttention = taskAgentStatus(task);
  const currentPr = selectCurrentPr(getTaskPrAssociationStore(task).pullRequests);
  const branchName =
    getTaskGitCheckoutStore(task.data.projectId, task.data.id)?.branchName ?? undefined;

  return (
    <TaskContextMenu
      isPinned={task.data.isPinned}
      canPin={canPin}
      isArchived={isArchived}
      branchName={branchName}
      onPin={() => void task.setPinned(true)}
      onUnpin={() => void task.setPinned(false)}
      onArchive={handleArchive}
      onRestore={handleRestore}
      onConvertAutomation={undefined}
      onDelete={handleDelete}
    >
      <div className="group flex w-full items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 truncate text-left text-sm">
            {getTaskDisplayName(task.data.projectId, task.data.id)}
          </span>
          <TaskGitDiffStats task={task} className="shrink-0 text-xs" />
          {currentPr && <PrBadge pr={currentPr} />}
        </div>
        <StackedAgentLogos stats={taskConversationStats(task)} />
        <div
          className={cn(
            'flex min-w-8 shrink-0 items-center justify-end',
            agentAttention ? 'justify-end' : 'justify-middle'
          )}
        >
          {agentAttention ? (
            <AgentStatus status={agentAttention} tooltip />
          ) : (
            <RelativeTime
              value={task.data.createdAt}
              className="pr-1 font-sans text-xs text-foreground-passive"
              compact
            />
          )}
        </div>
        <span className="flex items-center gap-0.5">
          {isArchived ? (
            <RowAction title="Restore" onClick={handleRestore}>
              <RotateCcw className="size-3.5" />
            </RowAction>
          ) : (
            <RowAction title="Archive" onClick={handleArchive}>
              <Archive className="size-3.5" />
            </RowAction>
          )}
          <RowAction title="Delete" onClick={handleDelete} destructive>
            <Trash2 className="size-3.5" />
          </RowAction>
        </span>
      </div>
    </TaskContextMenu>
  );
});

/** Hover icon action inside a row; a span so it never nests inside the row's button. */
function RowAction({
  title,
  onClick,
  destructive = false,
  children,
}: {
  title: string;
  onClick(): void;
  destructive?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      className={cn(
        'flex size-6 items-center justify-center rounded text-foreground-muted hover:bg-background-3',
        destructive ? 'hover:text-foreground-destructive' : 'hover:text-foreground'
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </span>
  );
}
