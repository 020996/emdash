import type { GitChange, GitChangeStatus } from '@emdash/core/runtimes/git/api';
import { SquareArrowRight, SquareDot, SquareMinus, SquarePlus, SquareX } from 'lucide-react';
import { forwardRef, useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { FileIcon } from '@core/features/editor/contributions/browser/file-icon';
import { splitPath } from '@core/features/tasks/api/browser/utils';
import { formatDiffLineCount } from '@core/primitives/formatting/browser/format-diff-line-count';
import { cn } from '@core/primitives/styling/browser/cn';
import { displayPathForChange } from './changes-tree-utils';

interface ChangesListItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  change: GitChange;
  rootPath?: string;
  isActive?: boolean;
  rowActions?: (change: GitChange) => ReactNode;
}

export const ChangesListItem = forwardRef<HTMLButtonElement, ChangesListItemProps>(
  ({ change, rootPath, isActive, rowActions, className, ...props }, ref) => {
    const displayPath = useMemo(
      () => displayPathForChange(change.path, rootPath),
      [change.path, rootPath]
    );
    const { filename, directory } = useMemo(() => splitPath(displayPath), [displayPath]);
    return (
      <button
        className={cn(
          'group/item w-full flex items-center gap-2 justify-between px-2 py-1 hover:bg-background-1 h-7 rounded-md',
          isActive && 'bg-background-2 hover:bg-background-2',
          className
        )}
        ref={ref}
        {...props}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <FileIcon filename={filename} size={12} />
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="max-w-full shrink-0 truncate text-sm">{filename}</span>
            {directory && (
              <span className="min-w-0 shrink truncate text-xs text-foreground-muted">
                {directory}
              </span>
            )}
          </span>
        </div>
        <ChangeStatusAffordance change={change} actions={rowActions?.(change)} />
      </button>
    );
  }
);

interface ChangeStatusAffordanceProps {
  change: GitChange;
  /** Hover-only per-file buttons (discard / stage / unstage), like VS Code. */
  actions?: ReactNode;
}

export function ChangeStatusAffordance({ change, actions }: ChangeStatusAffordanceProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      aria-label={`${change.additions} lines added, ${change.deletions} lines removed`}
    >
      {actions && (
        <span
          className="hidden items-center gap-0.5 group-hover/item:flex"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {actions}
        </span>
      )}
      <DiffLineStats additions={change.additions} deletions={change.deletions} />
    </div>
  );
}

function DiffLineStats({ additions, deletions }: { additions: number; deletions: number }) {
  if (additions === 0 && deletions === 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-1 text-xs leading-none tabular-nums">
      {additions > 0 && (
        <span className="text-foreground-diff-added">+{formatDiffLineCount(additions)}</span>
      )}
      {deletions > 0 && (
        <span className="text-foreground-diff-deleted">-{formatDiffLineCount(deletions)}</span>
      )}
    </span>
  );
}

export function GitChangeStatusIcon({
  status,
  className,
}: {
  status: GitChangeStatus;
  className?: string;
}) {
  switch (status) {
    case 'added':
      return <SquarePlus className={cn('size-4 text-foreground-diff-added', className)} />;
    case 'modified':
      return <SquareDot className={cn('size-4 text-foreground-diff-modified', className)} />;
    case 'deleted':
      return <SquareMinus className={cn('size-4 text-foreground-diff-deleted', className)} />;
    case 'renamed':
      return <SquareArrowRight className={cn('size-4 text-foreground-muted', className)} />;
    case 'conflicted':
      return <SquareX className={cn('size-4 text-foreground-conflict', className)} />;
    default:
      return null;
  }
}

/** Icon button inside a change row; a span because rows are already buttons. */
export function RowAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick(): void;
  children?: ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      className="flex size-5 items-center justify-center rounded text-foreground-muted hover:bg-background-3 hover:text-foreground"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </span>
  );
}
