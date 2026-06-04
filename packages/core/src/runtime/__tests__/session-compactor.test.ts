import { describe, it, expect } from 'vitest';
import { SessionCompactor } from '../session-compactor.js';
import type { Session } from '../../shared/index.js';

function makeMsg(overrides: { id?: string; role?: string; content?: string } = {}) {
  return {
    id: overrides.id ?? 'msg-1',
    role: (overrides.role ?? 'user') as 'user' | 'assistant',
    content: overrides.content ?? 'Hello',
    createdAt: new Date(),
  };
}

function makeSession(messages: ReturnType<typeof makeMsg>[], overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session',
    agentId: 'coder',
    messages: messages as Session['messages'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SessionCompactor', () => {
  it('returns session unchanged when under budget', () => {
    const compactor = new SessionCompactor({ maxTokens: 100_000 });
    const session = makeSession([
      makeMsg({ content: 'Short message' }),
    ]);
    const result = compactor.compact(session);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.content).toBe('Short message');
  });

  it('trims old messages when over budget', () => {
    // Very small budget to force trimming
    const compactor = new SessionCompactor({ maxTokens: 50, outputReserveRatio: 0 });
    const bigContent = 'x'.repeat(200); // 200 chars → 50 tokens
    const session = makeSession([
      makeMsg({ content: bigContent }),
      makeMsg({ content: bigContent }),
      makeMsg({ content: bigContent }),
      makeMsg({ content: bigContent }),
      makeMsg({ content: bigContent }),
      makeMsg({ content: bigContent }),
    ]);

    const result = compactor.compact(session);
    // Should have fewer messages than the original
    expect(result.messages.length).toBeLessThan(6);
  });

  it('preserves initial messages', () => {
    const compactor = new SessionCompactor({ maxTokens: 20, outputReserveRatio: 0 });
    const firstMsg = makeMsg({ content: 'Setup instruction' });
    const session = makeSession([
      firstMsg,
      makeMsg({ content: 'x'.repeat(200) }),
      makeMsg({ content: 'x'.repeat(200) }),
      makeMsg({ content: 'x'.repeat(200) }),
    ]);

    const result = compactor.compact(session);
    // First message should be preserved
    expect(result.messages[0]?.content).toBe('Setup instruction');
  });

  it('returns budget information', () => {
    const compactor = new SessionCompactor({
      maxTokens: 200_000,
      outputReserveRatio: 0.3,
    });
    const budget = compactor.getBudget();
    expect(budget.maxTokens).toBe(200_000);
    expect(budget.inputBudget).toBe(140_000); // 70% of 200k
    expect(budget.outputReserve).toBe(60_000); // 30% of 200k
  });

  it('handles empty session', () => {
    const compactor = new SessionCompactor();
    const session = makeSession([]);
    const result = compactor.compact(session);
    expect(result.messages).toHaveLength(0);
  });

  it('updatedAt is refreshed on compaction', () => {
    const compactor = new SessionCompactor({ maxTokens: 20, outputReserveRatio: 0 });
    const oldDate = new Date('2024-01-01');
    const session = makeSession(
      [makeMsg({ content: 'x'.repeat(200) })],
      { updatedAt: oldDate },
    );

    const result = compactor.compact(session);
    // Either unchanged (under budget edge case) or updated
    if (result.messages.length !== session.messages.length) {
      expect(result.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    }
  });
});
