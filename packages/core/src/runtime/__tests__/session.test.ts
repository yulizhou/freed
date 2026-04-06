import { describe, it, expect } from 'vitest';
import { createSession, appendMessages, trimSession } from '../session.js';
import type { AgentProfile, Message } from '../../shared/index.js';

const mockAgent: AgentProfile = {
  id: 'coder',
  name: 'Coder',
  model: 'anthropic/claude-opus-4-5',
  systemPrompt: 'You help.',
  tools: [],
};

const makeMsg = (content: string): Message => ({
  id: Math.random().toString(36).slice(2),
  role: 'user',
  content,
  createdAt: new Date(),
});

describe('createSession', () => {
  it('should create an empty session', () => {
    const session = createSession(mockAgent);
    expect(session.agentId).toBe('coder');
    expect(session.messages).toHaveLength(0);
    expect(session.id).toBeTruthy();
  });
});

describe('appendMessages', () => {
  it('should add messages to session', () => {
    const session = createSession(mockAgent);
    const updated = appendMessages(session, [makeMsg('hello')]);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0]?.content).toBe('hello');
  });

  it('should not mutate the original session', () => {
    const session = createSession(mockAgent);
    appendMessages(session, [makeMsg('hello')]);
    expect(session.messages).toHaveLength(0);
  });

  it('should update updatedAt', () => {
    const session = createSession(mockAgent);
    const before = session.updatedAt;
    const updated = appendMessages(session, [makeMsg('hi')]);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe('trimSession', () => {
  it('should return the same session if under limit', () => {
    const session = createSession(mockAgent);
    const withMsgs = appendMessages(session, [makeMsg('a'), makeMsg('b')]);
    const trimmed = trimSession(withMsgs, 10);
    expect(trimmed.messages).toHaveLength(2);
  });

  it('should keep only the last N messages', () => {
    const session = createSession(mockAgent);
    const msgs = ['a', 'b', 'c', 'd', 'e'].map(makeMsg);
    const withMsgs = appendMessages(session, msgs);
    const trimmed = trimSession(withMsgs, 3);
    expect(trimmed.messages).toHaveLength(3);
    expect(trimmed.messages[0]?.content).toBe('c');
  });
});
