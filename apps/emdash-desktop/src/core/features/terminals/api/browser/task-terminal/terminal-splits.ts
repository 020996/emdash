/** Drawer split groups: each group (2+ terminal ids) renders side by side. */

export function splitGroupOf(splits: readonly string[][] | undefined, id: string): string[] {
  return splits?.find((group) => group.includes(id)) ?? [id];
}

export function addToSplit(
  splits: readonly string[][] | undefined,
  anchorId: string,
  newId: string
): string[][] {
  const groups = (splits ?? []).map((group) => group.filter((id) => id !== newId));
  let group = groups.find((g) => g.includes(anchorId));
  if (!group) groups.push((group = [anchorId]));
  group.splice(group.indexOf(anchorId) + 1, 0, newId);
  return groups.filter((g) => g.length > 1);
}

export function pruneSplits(
  splits: readonly string[][] | undefined,
  live: ReadonlySet<string>
): string[][] {
  return (splits ?? [])
    .map((group) => group.filter((id) => live.has(id)))
    .filter((group) => group.length > 1);
}
