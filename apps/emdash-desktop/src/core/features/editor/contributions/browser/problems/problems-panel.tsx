import { encodeResourceUri, hostFileRef, type HostFileRef } from '@emdash/core/primitives/path/api';
import { EmptyState } from '@emdash/ui/react/components';
import { AlertTriangle, ChevronRight, CircleX, Info } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import { useEffect, useState, type ReactNode } from 'react';
import { encodeFacetUri } from '@core/features/editor/api/browser/facet-binder/facet-uri';
import type { SessionConnectionState } from '@core/features/editor/api/browser/lsp/language-session-client';
import { getFilesClient } from '@core/features/files/api/browser/client';
import {
  asProvisioned,
  getTaskStore,
} from '@core/features/tasks/api/browser/task-state/task-selectors';
import { hostFileRefFromNativePath } from '@core/primitives/desktop-runtime/api/paths';
import { cn } from '@core/primitives/styling/browser/cn';
import {
  getLanguageServices,
  openEditorLocation,
  taskLanguageRefs,
} from '../../../browser/lsp/language-services';
import { monacoBootstrap } from '../../../browser/monaco/monaco-bootstrap';
import { FileIcon } from '../file-icon';

type Context = { projectId: string; taskId: string };

export type Problem = {
  key: string;
  severity: Monaco.MarkerSeverity;
  message: string;
  source?: string;
  code?: string;
  range: Monaco.IRange;
};

export type ProblemFile = {
  key: string;
  ref: HostFileRef;
  name: string;
  directory: string;
  problems: Problem[];
};

/** Diagnostics for the task's workspace, grouped per file. Project-wide entries come from the
 * language servers attached to the task's open files (workspace-analysing servers such as Dart
 * report every file); open files use their live Monaco markers, which also cover local fallbacks. */
export function useTaskProblems(projectId: string, taskId: string): ProblemFile[] {
  const [, setVersion] = useState(0);
  const task = asProvisioned(getTaskStore(projectId, taskId));
  const workspacePath = task?.workspacePath ?? undefined;
  const connectionId = task?.workspaceSshConnectionId;
  const [projects, setProjects] = useState<
    { root: HostFileRef; watch: { readonly connection: SessionConnectionState } }[]
  >([]);
  useEffect(() => {
    if (!workspacePath) return;
    const root = hostFileRefFromNativePath(workspacePath, connectionId);
    const active: {
      root: HostFileRef;
      watch: { readonly connection: SessionConnectionState; dispose(): Promise<void> };
    }[] = [];
    let disposed = false;
    void (async () => {
      await monacoBootstrap.init();
      const files = await getFilesClient();
      for (const [serverId, marker] of Object.entries(PROJECT_MARKERS)) {
        const markerRef = hostFileRef(root.host, {
          ...root.path,
          segments: [...root.path.segments, marker],
        });
        const exists = await files.fs.exists({ uri: encodeResourceUri(markerRef) });
        if (disposed) return;
        const watch =
          exists.success && exists.data.exists
            ? getLanguageServices()?.watchProject(root, serverId)
            : undefined;
        if (watch) active.push({ root, watch });
      }
      setProjects([...active]);
    })();
    return () => {
      disposed = true;
      for (const { watch } of active) void watch.dispose();
    };
  }, [workspacePath, connectionId]);
  useEffect(() => {
    let subscription: Monaco.IDisposable | undefined;
    let disposed = false;
    // The drawer can mount before any editor loaded Monaco; init() is shared and idempotent.
    void monacoBootstrap.init().then((loaded) => {
      if (disposed) return;
      subscription = loaded.editor.onDidChangeMarkers(() => setVersion((v) => v + 1));
      setVersion((v) => v + 1);
    });
    return () => {
      disposed = true;
      subscription?.dispose();
    };
  }, []);
  const monaco = monacoBootstrap.getMonaco();
  if (!monaco) return [];

  const files = new Map<string, ProblemFile>();
  const put = (ref: HostFileRef, root: HostFileRef, problems: Problem[]) => {
    const key = encodeFacetUri(ref, { kind: 'buffer' });
    if (problems.length === 0) {
      files.delete(key);
      return;
    }
    const segments = ref.path.segments;
    files.set(key, {
      key,
      ref,
      name: segments.at(-1) ?? '',
      directory: segments.slice(isUnder(ref, root) ? root.path.segments.length : 0, -1).join('/'),
      problems: problems.sort(
        (a, b) => b.severity - a.severity || a.range.startLineNumber - b.range.startLineNumber
      ),
    });
  };

  const registrations = taskLanguageRefs(taskId);
  const servers = [
    ...projects.map(({ root, watch }) => ({ ref: root, root, connection: watch.connection })),
    ...registrations.map(({ ref, root }) => ({
      ref,
      root,
      connection: getLanguageServices()?.status(ref)?.connection,
    })),
  ];
  for (const { ref, root, connection } of servers) {
    if (connection?.kind !== 'connected' || connection.server.phase !== 'ready') continue;
    for (const entry of connection.server.diagnostics) {
      const fileRef: HostFileRef = { host: ref.host, path: entry.path };
      if (!isUnder(fileRef, root)) continue;
      put(
        fileRef,
        root,
        entry.diagnostics.map((diagnostic, i) => ({
          key: `${i}`,
          severity: LSP_SEVERITY[(diagnostic.severity ?? 1) - 1],
          message: diagnostic.message,
          source: diagnostic.source,
          code: diagnostic.code === undefined ? undefined : String(diagnostic.code),
          range: {
            startLineNumber: diagnostic.range.start.line + 1,
            startColumn: diagnostic.range.start.character + 1,
            endLineNumber: diagnostic.range.end.line + 1,
            endColumn: diagnostic.range.end.character + 1,
          },
        }))
      );
    }
  }
  // Open files: live markers win over the last project-wide report.
  for (const { ref, root } of registrations) {
    const resource = monaco.Uri.parse(encodeFacetUri(ref, { kind: 'buffer' }));
    put(
      ref,
      root,
      monaco.editor.getModelMarkers({ resource }).map((marker, i) => ({
        key: `${i}`,
        severity: marker.severity,
        message: marker.message,
        source: marker.source,
        code: typeof marker.code === 'object' ? marker.code.value : marker.code,
        range: marker,
      }))
    );
  }
  return [...files.values()].sort(
    (a, b) => b.problems[0].severity - a.problems[0].severity || a.name.localeCompare(b.name)
  );
}

/** Servers that analyse the whole workspace, started from Problems when their marker is at the root.
 * Others (TypeScript, Pyright…) only report open files, so starting them here adds nothing. */
const PROJECT_MARKERS: Record<string, string> = { dart: 'pubspec.yaml', rust: 'Cargo.toml' };

// LSP DiagnosticSeverity 1-4 as Monaco MarkerSeverity (Error, Warning, Info, Hint).
const LSP_SEVERITY = [8, 4, 2, 1] as Monaco.MarkerSeverity[];

function isUnder(ref: HostFileRef, root: HostFileRef): boolean {
  return (
    JSON.stringify(ref.path.root) === JSON.stringify(root.path.root) &&
    root.path.segments.every((segment, i) => ref.path.segments[i] === segment)
  );
}

// Monaco MarkerSeverity: Error = 8, Warning = 4; Info/Hint fall back to the info icon.
const SEVERITY_ICON: Partial<Record<number, ReactNode>> = {
  8: <CircleX className="text-destructive size-3.5 shrink-0" />,
  4: <AlertTriangle className="size-3.5 shrink-0 text-foreground-warning" />,
};

/** Above this many problems files start collapsed: a workspace scan can report tens of thousands,
 * and rendering every row at once stalls the drawer. */
const EXPAND_ALL_LIMIT = 200;

export function ProblemsPanel({ files, context }: { files: ProblemFile[]; context: Context }) {
  // Keys whose state differs from the default, so the default can follow the total.
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  if (files.length === 0) {
    return <EmptyState bare label="No problems" description="No diagnostics in this workspace." />;
  }
  const total = files.reduce((sum, file) => sum + file.problems.length, 0);
  const expandByDefault = total <= EXPAND_ALL_LIMIT;
  const toggle = (key: string) =>
    setToggled((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return (
    <div className="h-full overflow-auto px-1 py-1 text-sm" aria-label="Problems">
      {files.map((file) => {
        const expanded = expandByDefault !== toggled.has(file.key);
        return (
          <div key={file.key}>
            <button
              type="button"
              aria-expanded={expanded}
              className="em-glass-item flex h-7 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-background-1"
              onClick={() => toggle(file.key)}
            >
              <ChevronRight
                className={cn('size-3.5 shrink-0 text-foreground-muted', expanded && 'rotate-90')}
              />
              <FileIcon filename={file.name} size={14} />
              <span className="truncate text-foreground">{file.name}</span>
              <span className="truncate text-foreground-muted">{file.directory}</span>
              <span className="rounded-full bg-background-2 px-1.5 text-xs text-foreground-muted">
                {file.problems.length}
              </span>
            </button>
            {expanded &&
              file.problems.map((problem) => (
                <button
                  key={problem.key}
                  type="button"
                  className="em-glass-item flex h-7 w-full items-center gap-2 rounded-md pr-3 pl-8 text-left hover:bg-background-1"
                  onClick={() => openEditorLocation(context, file.ref, problem.range)}
                >
                  {SEVERITY_ICON[problem.severity] ?? (
                    <Info className="size-3.5 shrink-0 text-foreground-muted" />
                  )}
                  <span className="truncate text-foreground">{problem.message}</span>
                  {problem.source && (
                    <span className="shrink-0 text-foreground-muted">
                      {problem.source}
                      {problem.code ? `(${problem.code})` : ''}
                    </span>
                  )}
                  <span className="shrink-0 text-foreground-muted">
                    [Ln {problem.range.startLineNumber}, Col {problem.range.startColumn}]
                  </span>
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
}
