import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SessionStore } from '../session-store.js';
import type { Session } from '../../shared/index.js';

const TEST_DIR = path.join(os.tmpdir(), `freed-session-test-${Date.now()}`);

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date('2024-01-15T10:00:00Z');
  return {
    id: 'test-session-1',
    agentId: 'coder',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, can you help with TypeScript?',
        createdAt: now,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Of course! What do you need help with?',
        createdAt: new Date('2024-01-15T10:00:05Z'),
      },
    ],
    createdAt: now,
    updatedAt: new Date('2024-01-15T10:00:05Z'),
    ...overrides,
  };
}

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(async () => {
    // Clean test session files from previous runs
    try {
      const files = await fs.readdir(TEST_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(TEST_DIR, file));
        }
      }
    } catch {
      // dir may not exist yet
    }
    store = new SessionStore(TEST_DIR);
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('saves and loads a session correctly', async () => {
    const session = makeSession();
    await store.save(session);

    const loaded = await store.load('test-session-1');
    expect(loaded).not.toBeNull();
    if (!loaded) throw new Error('Expected loaded session');

    expect(loaded.id).toBe('test-session-1');
    expect(loaded.agentId).toBe('coder');
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[0]!.content).toBe('Hello, can you help with TypeScript?');
    // Dates should be revived as Date objects
    expect(loaded.createdAt).toBeInstanceOf(Date);
    expect(loaded.updatedAt).toBeInstanceOf(Date);
    expect(loaded.messages[0]!.createdAt).toBeInstanceOf(Date);
  });

  it('returns null for non-existent session', async () => {
    const loaded = await store.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('lists saved sessions ordered by most recent', async () => {
    const older = makeSession({
      id: 'test-old',
      updatedAt: new Date('2024-01-15T10:00:00Z'),
    });
    const newer = makeSession({
      id: 'test-new',
      updatedAt: new Date('2024-01-15T11:00:00Z'),
    });

    await store.save(older);
    await store.save(newer);

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0]!.sessionId).toBe('test-new'); // most recent first
    expect(list[1]!.sessionId).toBe('test-old');
  });

  it('provides preview text from first user message', async () => {
    const session = makeSession();
    await store.save(session);

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.preview).toBe('Hello, can you help with TypeScript?');
    expect(list[0]!.messageCount).toBe(2);
    expect(list[0]!.agentId).toBe('coder');
  });

  it('deletes a session', async () => {
    const session = makeSession();
    await store.save(session);

    await store.delete('test-session-1');
    const loaded = await store.load('test-session-1');
    expect(loaded).toBeNull();
  });

  it('delete is no-op for non-existent session', async () => {
    await expect(store.delete('nonexistent')).resolves.not.toThrow();
  });

  it('list returns empty array when no sessions exist', async () => {
    // beforeEach already cleans up files, so this should be empty
    const list = await store.list();
    expect(list).toEqual([]);
  });

  it('handles empty messages', async () => {
    const session = makeSession({ messages: [] });
    await store.save(session);

    const loaded = await store.load('test-session-1');
    expect(loaded).not.toBeNull();
    if (!loaded) throw new Error('Expected loaded session');

    expect(loaded.messages).toHaveLength(0);

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.preview).toBeUndefined();
  });
});
