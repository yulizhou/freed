import { nanoid } from 'nanoid';
import type { Session, Message, AgentProfile } from '../shared/index.js';

/**
 * Creates a new empty session.
 */
export function createSession(agentProfile: AgentProfile): Session {
  const now = new Date();
  return {
    id: nanoid(),
    agentId: agentProfile.id,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Appends messages to a session and updates updatedAt.
 */
export function appendMessages(session: Session, messages: Message[]): Session {
  return {
    ...session,
    messages: [...session.messages, ...messages],
    updatedAt: new Date(),
  };
}

/**
 * Returns the last N messages (for context window management).
 */
export function trimSession(session: Session, maxMessages: number): Session {
  if (session.messages.length <= maxMessages) return session;
  return {
    ...session,
    messages: session.messages.slice(-maxMessages),
  };
}
