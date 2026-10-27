import { useEffect, useState } from 'react';
import { FileIcon } from '@core/features/editor/contributions/browser/file-icon';
import { getSearchClient } from '@core/features/search/api/client';
import { useTaskComposition } from '@core/features/workbench/api/browser/task-composition-context';
import { useDebounce } from '@core/primitives/react-hooks/browser/useDebounce';
import type { WorkspaceFileHit } from '@core/primitives/search/api';

const SEARCH_DEBOUNCE_MS = 150;
const FILE_NAME_LIMIT = 50;

/** File-name matches (like VS Code Cmd+P) shown above the content results. */
export function FileNameSearchResults({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: string;
}) {
  const taskView = useTaskComposition();
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const [hits, setHits] = useState<readonly WorkspaceFileHit[]>([]);

  useEffect(() => {
    if (!debouncedQuery) return setHits([]);
    let disposed = false;
    void getSearchClient()
      .then((client) =>
        client.searchWorkspaceFiles({ workspaceId, query: debouncedQuery, limit: FILE_NAME_LIMIT })
      )
      .then((result) => !disposed && setHits(result))
      .catch(() => !disposed && setHits([]));
    return () => {
      disposed = true;
    };
  }, [debouncedQuery, workspaceId]);

  if (hits.length === 0) return null;

  return (
    <div className="flex max-h-64 shrink-0 flex-col overflow-y-auto border-b border-border py-1">
      <span className="px-3 py-1 text-xs text-foreground-passive">Files</span>
      {hits.map((hit) => (
        <button
          key={hit.resource}
          type="button"
          className="flex min-w-0 items-center gap-2 px-3 py-1 text-left text-sm hover:bg-background-1"
          onClick={() => taskView.paneLayout.open('file', { path: hit.relativePath })}
        >
          <FileIcon filename={hit.filename} size={14} />
          <span className="shrink-0">{hit.filename}</span>
          <span className="truncate text-xs text-foreground-passive">{hit.relativePath}</span>
        </button>
      ))}
    </div>
  );
}
