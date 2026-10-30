/** Git conflict-marker blocks; all fields are 0-based line indexes. */
export interface MergeConflict {
  start: number;
  /** `|||||||` line of diff3-style conflicts. */
  base?: number;
  separator: number;
  end: number;
}

export type ConflictChoice = 'current' | 'incoming' | 'both';

export function findConflicts(lines: readonly string[]): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  let open: Partial<MergeConflict> | null = null;
  lines.forEach((line, index) => {
    if (line.startsWith('<<<<<<<')) open = { start: index };
    else if (!open) return;
    else if (line.startsWith('|||||||') && open.separator === undefined) open.base = index;
    else if (line.startsWith('=======') && open.separator === undefined) open.separator = index;
    else if (line.startsWith('>>>>>>>') && open.separator !== undefined) {
      conflicts.push({ ...open, end: index } as MergeConflict);
      open = null;
    }
  });
  return conflicts;
}

/** Lines that replace the whole conflict block (markers included) for `choice`. */
export function resolveConflict(
  lines: readonly string[],
  conflict: MergeConflict,
  choice: ConflictChoice
): string[] {
  const current = lines.slice(conflict.start + 1, conflict.base ?? conflict.separator);
  const incoming = lines.slice(conflict.separator + 1, conflict.end);
  if (choice === 'current') return current;
  if (choice === 'incoming') return incoming;
  return [...current, ...incoming];
}
