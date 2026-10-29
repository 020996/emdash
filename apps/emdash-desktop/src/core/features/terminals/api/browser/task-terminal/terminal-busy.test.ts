import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerminalStore } from '@core/features/terminals/api/browser/task-terminal/terminal-manager';
import type { Terminal } from '@core/primitives/terminals/api';

const terminal = {
  id: 't',
  projectId: 'p',
  taskId: 'k',
  shellId: 'system',
  name: 'T',
} satisfies Terminal;

describe('TerminalStore busy heuristic', () => {
  afterEach(() => vi.useRealTimers());

  it('turns busy only once output keeps flowing, and idles after a quiet period', () => {
    vi.useFakeTimers();
    const store = new TerminalStore(terminal);
    store.noteOutput();
    expect(store.isBusy).toBe(false);
    vi.advanceTimersByTime(1_000);
    store.noteOutput();
    expect(store.isBusy).toBe(true);
    vi.advanceTimersByTime(5_000);
    expect(store.isBusy).toBe(false);
  });

  it('ignores a one-off redraw burst', () => {
    vi.useFakeTimers();
    const store = new TerminalStore(terminal);
    store.noteOutput();
    vi.advanceTimersByTime(100);
    store.noteOutput();
    expect(store.isBusy).toBe(false);
  });

  it('ignores the echo of recent typing or resizing', () => {
    vi.useFakeTimers();
    const store = new TerminalStore(terminal);
    store.noteOutput();
    vi.advanceTimersByTime(1_000);
    store.noteInput();
    store.noteOutput();
    expect(store.isBusy).toBe(false);
  });
});
