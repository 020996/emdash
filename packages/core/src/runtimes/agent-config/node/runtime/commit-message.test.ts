import { describe, expect, it } from 'vitest';
import { buildCommitMessagePrompt, cleanCommitMessage } from './commit-message';

describe('commit message generation', () => {
  it('builds a prompt with style samples, file list and a capped diff', () => {
    const prompt = buildCommitMessagePrompt({
      status: 'M a.ts',
      diff: 'x'.repeat(30_000),
      recentSubjects: 'Feat: [update] agent state\n',
    });
    expect(prompt).toContain('Feat: [update] agent state');
    expect(prompt).toContain('M a.ts');
    expect(prompt).toContain('[diff truncated]');
    expect(prompt.length).toBeLessThan(21_000);
  });

  it('strips a wrapping code fence', () => {
    expect(cleanCommitMessage('```text\nfix: thing\n```\n')).toBe('fix: thing');
    expect(cleanCommitMessage('  feat: x\n\nbody\n')).toBe('feat: x\n\nbody');
  });
});
