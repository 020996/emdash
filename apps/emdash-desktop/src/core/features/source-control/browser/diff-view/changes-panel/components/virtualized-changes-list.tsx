import type { GitChange, GitFilePath } from '@emdash/core/runtimes/git/api';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { cn } from '@core/primitives/styling/browser/cn';
import { ChangesListItem } from './changes-list-item';

export interface VirtualizedChangesListProps {
  changes: GitChange[];
  rootPath?: string;
  onSelectChange?: (change: GitChange) => void;
  onDoubleClickChange?: (change: GitChange) => void;
  onPrefetch?: (change: GitChange) => void;
  rowActions?: (change: GitChange) => ReactNode;
  activePath?: GitFilePath;
  className?: string;
}

const ITEM_HEIGHT = 28;

export function VirtualizedChangesList({
  changes,
  rootPath,
  onSelectChange,
  onDoubleClickChange,
  onPrefetch,
  rowActions,
  activePath,
  className,
}: VirtualizedChangesListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: changes.length,
    gap: 2,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });
  return (
    <div
      ref={parentRef}
      className={cn('h-full overflow-y-auto overflow-x-hidden py-2 px-1', className)}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const change = changes[virtualItem.index]!;
          return (
            <ChangesListItem
              key={change.path}
              change={change}
              rootPath={rootPath}
              isActive={change.path === activePath}
              rowActions={rowActions}
              style={{
                position: 'absolute',
                top: virtualItem.start,
                left: 0,
                width: '100%',
                height: ITEM_HEIGHT,
              }}
              onClick={() => onSelectChange?.(change)}
              onDoubleClick={() => onDoubleClickChange?.(change)}
              onMouseEnter={() => onPrefetch?.(change)}
            />
          );
        })}
      </div>
    </div>
  );
}
