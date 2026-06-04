import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Session, SessionSummary } from '../shared/index.js';

function defaultSessionsDir(): string {
  return path.join(os.homedir(), '.freed', 'sessions');
}

function toSummary(session: Session): SessionSummary {
  const firstUserMsg = session.messages.find((m) => m.role === 'user');
  const preview = firstUserMsg
    ? firstUserMsg.content.slice(0, 120).replace(/\n/g, ' ')
    : undefined;
  return {
    id: session.id,
    sessionId: session.id,
    agentId: session.agentId,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    preview,
  };
}

/**
 * JSON file-based session persistence.
 * Stores sessions under ~/.freed/sessions/{id}.json by default.
 * Pass a custom baseDir to use a different directory (useful for testing).
 */
export class SessionStore {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? defaultSessionsDir();
  }

  private sessionPath(sessionId: string): string {
    return path.join(this.baseDir, `${sessionId}.json`);
  }

  /**
   * Persist a session to disk.
   * Serializes Date objects to ISO strings for JSON round-tripping.
   */
  async save(session: Session): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Load a session from disk by ID. Returns null if not found.
   * Parses ISO date strings back to Date objects.
   */
  async load(sessionId: string): Promise<Session | null> {
    try {
      const raw = await fs.readFile(this.sessionPath(sessionId), 'utf-8');
      const data = JSON.parse(raw);
      return reviveSessionDates(data);
    } catch {
      return null;
    }
  }

  /**
   * List all saved sessions, ordered by most recent first.
   * Returns lightweight summaries without full message content.
   */
  async list(): Promise<SessionSummary[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      const summaries: SessionSummary[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await fs.readFile(path.join(this.baseDir, file), 'utf-8');
          const data = JSON.parse(raw);
          const session = reviveSessionDates(data);
          summaries.push(toSummary(session));
        } catch {
          // skip corrupt files
        }
      }
      return summaries.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    } catch {
      return [];
    }
  }

  /**
   * Delete a session by ID. No-op if not found.
   */
  async delete(sessionId: string): Promise<void> {
    try {
      await fs.unlink(this.sessionPath(sessionId));
    } catch {
      // ignore missing file
    }
  }
}

/**
 * Revive ISO date strings into Date objects after JSON.parse.
 * Recurses into messages array.
 */
function reviveSessionDates(data: Record<string, unknown>): Session {
  const revived = { ...data } as Session;
  if (typeof revived.createdAt === 'string') {
    revived.createdAt = new Date(revived.createdAt as string);
  }
  if (typeof revived.updatedAt === 'string') {
    revived.updatedAt = new Date(revived.updatedAt as string);
  }
  if (Array.isArray(revived.messages)) {
    revived.messages = revived.messages.map((m: Record<string, unknown>) => ({
      ...m,
      createdAt: typeof m.createdAt === 'string' ? new Date(m.createdAt as string) : (m.createdAt as Date),
    })) as Session['messages'];
  }
  return revived;
}
