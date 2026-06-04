import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateMessageTokens } from '../token-counter.js';
import type { Message } from '../../shared/index.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens as chars/4', () => {
    expect(estimateTokens('hello')).toBe(2); // 5 chars → ceil(5/4) = 2
    expect(estimateTokens('hello world')).toBe(3); // 11 chars → ceil(11/4) = 3
  });

  it('returns ceil for partial ratio', () => {
    expect(estimateTokens('abc')).toBe(1); // 3/4 = 0.75 → ceil = 1
    expect(estimateTokens('abcde')).toBe(2); // 5/4 = 1.25 → ceil = 2
    expect(estimateTokens('abcdefgh')).toBe(2); // 8/4 = 2
  });

  it('scales linearly with text length', () => {
    const short = estimateTokens('a'.repeat(100));
    const long = estimateTokens('a'.repeat(1000));
    expect(long).toBe(short * 10);
    expect(short).toBe(25);
    expect(long).toBe(250);
  });
});

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('estimateMessageTokens', () => {
  it('returns 0 for empty array', () => {
    expect(estimateMessageTokens([])).toBe(0);
  });

  it('accounts for per-message framing overhead', () => {
    const msgs = [makeMsg({ content: 'Hi' })];
    // 4 overhead + ceil(2/4) = 4 + 1 = 5
    const tokens = estimateMessageTokens(msgs);
    expect(tokens).toBeGreaterThan(0);
  });

  it('includes tool result content', () => {
    const msgs = [
      makeMsg({
        role: 'assistant',
        content: 'Running tool',
        toolResult: {
          success: true,
          output: 'Some output text here',
        },
      }),
    ];
    const tokens = estimateMessageTokens(msgs);
    expect(tokens).toBeGreaterThan(estimateMessageTokens([makeMsg({ content: 'Running tool' })]));
  });

  it('includes tool result error', () => {
    const msgs = [
      makeMsg({
        role: 'assistant',
        content: 'Failed',
        toolResult: {
          success: false,
          output: '',
          error: 'Something went wrong',
        },
      }),
    ];
    const tokens = estimateMessageTokens(msgs);
    expect(tokens).toBeGreaterThan(0);
  });

  it('sums across multiple messages', () => {
    const msgs = [
      makeMsg({ content: 'First' }),
      makeMsg({ content: 'Second' }),
      makeMsg({ content: 'Third' }),
    ];
    const total = estimateMessageTokens(msgs);
    // Each message gets 4 overhead + content
    expect(total).toBe(3 * 4 + estimateTokens('First') + estimateTokens('Second') + estimateTokens('Third'));
  });
});
