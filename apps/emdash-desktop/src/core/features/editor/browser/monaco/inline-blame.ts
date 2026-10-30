import type { BlameHunk } from '@emdash/core/runtimes/git/api';
import { formatDistanceToNow } from 'date-fns';
import type * as monacoNS from 'monaco-editor';
import {
  checkoutSelector,
  getSourceControlClient,
  gitFilePath,
} from '@core/features/source-control/api/browser/client';

export interface BlameTarget {
  workspaceId: string;
  relativePath: string;
}

/** margin-left (3em) plus slack for the cursor and wrap indicator. */
const BLAME_MARGIN_CHARS = 8;
const UNCOMMITTED_OID = /^0+$/;

function label(hunk: BlameHunk): string {
  if (UNCOMMITTED_OID.test(hunk.oid)) return 'You • Uncommitted changes';
  return `${hunk.author}, ${formatDistanceToNow(hunk.date, { addSuffix: true })} • ${hunk.summary}`;
}

async function fetchBlame(target: BlameTarget): Promise<BlameHunk[]> {
  const client = await getSourceControlClient();
  const result = await client.checkout.blame({
    ...checkoutSelector(target.workspaceId),
    path: gitFilePath(target.relativePath),
  });
  return result.success ? result.data.hunks : [];
}

/** GitLens-style "author, time ago • summary" after the cursor line. */
export function installInlineBlame(
  editor: monacoNS.editor.IStandaloneCodeEditor,
  m: typeof monacoNS,
  getTarget: () => BlameTarget | null
): () => void {
  const collection = editor.createDecorationsCollection();
  // ponytail: blames the file on disk; unsaved edits shift lines until saved. Edits drop the cache.
  const cache = new Map<string, Promise<BlameHunk[]>>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const render = async () => {
    const target = getTarget();
    const line = editor.getPosition()?.lineNumber;
    const model = editor.getModel();
    collection.clear();
    if (!target || !line || !model) return;
    const key = `${target.workspaceId}:${target.relativePath}`;
    let hunks = cache.get(key);
    if (!hunks) cache.set(key, (hunks = fetchBlame(target).catch(() => [])));
    const hunk = (await hunks).find((h) => line >= h.startLine && line < h.startLine + h.lineCount);
    if (!hunk || editor.getModel() !== model || editor.getPosition()?.lineNumber !== line) return;
    const column = model.getLineMaxColumn(line);
    // Word wrap would push a long label onto a second row; trim it to the space left.
    const { contentWidth } = editor.getLayoutInfo();
    const charWidth = editor.getOption(
      m.editor.EditorOption.fontInfo
    ).typicalHalfwidthCharacterWidth;
    const room = Math.floor(contentWidth / charWidth) - (column - 1) - BLAME_MARGIN_CHARS;
    if (room < 8) return;
    const text = label(hunk);
    const content = text.length > room ? `${text.slice(0, room - 1)}…` : text;
    collection.set([
      {
        range: new m.Range(line, column, line, column),
        options: {
          showIfCollapsed: true,
          after: { content, inlineClassName: 'em-inline-blame' },
        },
      },
    ]);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void render(), 300);
  };

  const subscriptions = [
    editor.onDidChangeCursorPosition(schedule),
    editor.onDidChangeModel(schedule),
    editor.onDidChangeModelContent(() => {
      cache.clear();
      collection.clear();
    }),
  ];
  return () => {
    clearTimeout(timer);
    subscriptions.forEach((s) => s.dispose());
    collection.clear();
  };
}
