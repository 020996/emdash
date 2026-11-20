import { describe, expect, it } from 'vitest';
import { cleanTerminalTitle, lastTerminalTitle } from './terminal-title';

describe('lastTerminalTitle', () => {
  it('returns the last OSC 0/2 title in a chunk, BEL or ST terminated', () => {
    expect(lastTerminalTitle('a\x1b]0;first\x07b\x1b]2;second\x1b\\c')).toBe('second');
  });

  it('ignores chunks without a complete title sequence', () => {
    expect(lastTerminalTitle('plain output')).toBeUndefined();
    expect(lastTerminalTitle('\x1b]0;unterminated')).toBeUndefined();
    expect(lastTerminalTitle('\x1b]8;;https://x\x07link')).toBeUndefined();
  });
});

describe('cleanTerminalTitle', () => {
  it('strips spinner and status glyphs', () => {
    expect(cleanTerminalTitle('✳ History-video continuation', 'claude')).toBe(
      'History-video continuation'
    );
    expect(cleanTerminalTitle('⠂ Kiểm thử phần mềm mới', 'claude')).toBe('Kiểm thử phần mềm mới');
  });

  it('drops titles that carry no information', () => {
    expect(cleanTerminalTitle('✳ Claude Code', 'claude')).toBeUndefined();
    expect(cleanTerminalTitle('codex', 'codex')).toBeUndefined();
    expect(cleanTerminalTitle('~/Documents/Company/shopify', 'claude')).toBeUndefined();
    expect(cleanTerminalTitle('..y/mobile-admin-shopify', 'claude')).toBeUndefined();
    expect(cleanTerminalTitle('/usr/bin/zsh', 'claude')).toBeUndefined();
    expect(cleanTerminalTitle(' ✳ ', 'claude')).toBeUndefined();
  });
});
