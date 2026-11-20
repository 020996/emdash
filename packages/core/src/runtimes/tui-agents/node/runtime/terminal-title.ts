// ponytail: OSC 0/2 title within one PTY chunk; a split title waits for the agent's next
// re-emit (agents re-set it on every status change). Add a carry buffer if titles go missing.
const OSC_TITLE = /\x1b\][02];([^\x07\x1b]*)(?:\x07|\x1b\\)/g;

/** Last terminal title set by an OSC 0/2 sequence in `chunk`, raw. */
export function lastTerminalTitle(chunk: string): string | undefined {
  let title: string | undefined;
  for (const match of chunk.matchAll(OSC_TITLE)) title = match[1];
  return title;
}

/** Agent terminal title as a conversation title; `undefined` for agent names, paths, glyphs. */
export function cleanTerminalTitle(raw: string, providerId?: string): string | undefined {
  const title = raw.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (!title) return undefined;
  if (/^[~./]/.test(raw.trim())) return undefined;
  const lower = title.toLowerCase();
  if (lower === 'claude code' || (providerId && lower === providerId.toLowerCase())) {
    return undefined;
  }
  return title;
}
