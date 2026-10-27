import { describe, expect, it } from 'vitest';
import { conversationTitleFromTerminalTitle } from './conversation-title-utils';

describe('conversationTitleFromTerminalTitle', () => {
  it('strips the status glyph and ignores the default title', () => {
    expect(conversationTitleFromTerminalTitle('◐ Greeting reply')).toBe('Greeting reply');
    expect(conversationTitleFromTerminalTitle('✳ Sửa lỗi đổi ngôn ngữ')).toBe(
      'Sửa lỗi đổi ngôn ngữ'
    );
    expect(conversationTitleFromTerminalTitle('✳ Claude Code')).toBeNull();
    expect(conversationTitleFromTerminalTitle('✳ ')).toBeNull();
  });
});
