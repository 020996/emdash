import type * as monacoNS from 'monaco-editor';
import {
  findConflicts,
  resolveConflict,
  type ConflictChoice,
  type MergeConflict,
} from './merge-conflicts-parser';

const ACCEPT_COMMAND = 'emdash.mergeConflict.accept';
const LENSES: Array<[ConflictChoice, string]> = [
  ['current', 'Accept Current Change'],
  ['incoming', 'Accept Incoming Change'],
  ['both', 'Accept Both Changes'],
];

let registered = false;

/** Global (once): CodeLens provider + accept command shared by every editor. */
function registerOnce(m: typeof monacoNS): void {
  if (registered) return;
  registered = true;

  m.editor.registerCommand(ACCEPT_COMMAND, (_accessor, uri: string, start: number, choice) => {
    const model = m.editor.getModel(m.Uri.parse(uri));
    if (!model) return;
    const lines = model.getLinesContent();
    const conflict = findConflicts(lines).find((c) => c.start === start);
    if (!conflict) return;
    const replacement = resolveConflict(lines, conflict, choice as ConflictChoice);
    // Line numbers are 1-based; an empty resolution also swallows the trailing newline.
    const range =
      replacement.length === 0 && conflict.end + 2 <= model.getLineCount()
        ? new m.Range(conflict.start + 1, 1, conflict.end + 2, 1)
        : new m.Range(
            conflict.start + 1,
            1,
            conflict.end + 1,
            model.getLineMaxColumn(conflict.end + 1)
          );
    model.pushEditOperations([], [{ range, text: replacement.join(model.getEOL()) }], () => null);
  });

  m.languages.registerCodeLensProvider('*', {
    provideCodeLenses: (model) => ({
      lenses: findConflicts(model.getLinesContent()).flatMap((conflict) =>
        LENSES.map(([choice, title]) => ({
          range: new m.Range(conflict.start + 1, 1, conflict.start + 1, 1),
          command: {
            id: ACCEPT_COMMAND,
            title,
            arguments: [model.uri.toString(), conflict.start, choice],
          },
        }))
      ),
      dispose: () => {},
    }),
  });
}

function decorations(conflict: MergeConflict, m: typeof monacoNS) {
  const block = (from: number, to: number, className: string) => ({
    range: new m.Range(from + 1, 1, to + 1, 1),
    options: { isWholeLine: true, className },
  });
  const currentEnd = (conflict.base ?? conflict.separator) - 1;
  return [
    block(conflict.start, conflict.start, 'em-conflict-marker'),
    ...(currentEnd > conflict.start
      ? [block(conflict.start + 1, currentEnd, 'em-conflict-current')]
      : []),
    ...(conflict.end - 1 > conflict.separator
      ? [block(conflict.separator + 1, conflict.end - 1, 'em-conflict-incoming')]
      : []),
    block(conflict.end, conflict.end, 'em-conflict-marker'),
  ];
}

/** Highlights conflict blocks in `editor` and enables the Accept CodeLens. */
export function installMergeConflicts(
  editor: monacoNS.editor.IStandaloneCodeEditor,
  m: typeof monacoNS
): () => void {
  registerOnce(m);
  const collection = editor.createDecorationsCollection();
  const update = () => {
    const model = editor.getModel();
    collection.set(
      model ? findConflicts(model.getLinesContent()).flatMap((c) => decorations(c, m)) : []
    );
  };
  update();
  const subscriptions = [editor.onDidChangeModel(update), editor.onDidChangeModelContent(update)];
  return () => {
    subscriptions.forEach((s) => s.dispose());
    collection.clear();
  };
}
