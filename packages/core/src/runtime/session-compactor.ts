import { nanoid } from 'nanoid';
import type { Message, Session } from '../shared/index.js';
import { estimateTokens, estimateMessageTokens } from './token-counter.js';

export interface CompactionOptions {
  /** Maximum total tokens allowed in the session context (default 200K). */
  maxTokens?: number;
  /** Fraction of maxTokens reserved for output/new messages (default 0.3). */
  outputReserveRatio?: number;
  /** Maximum tokens for the summary message (default 500). */
  summaryMaxTokens?: number;
}

const DEFAULT_MAX_TOKENS = 200_000;
const DEFAULT_OUTPUT_RESERVE = 0.3;
const DEFAULT_SUMMARY_MAX_TOKENS = 500;
const FRAMING_OVERHEAD = 8;

/**
 * Three-tier session compaction strategy:
 * 1. **Trim** — drop oldest messages until within budget
 * 2. **Summarize** — if still over after max trim, replace middle with a summary
 * 3. **Truncate** — as last resort, drop all but most recent messages
 *
 * Always preserves the system setup (first 2 messages if user/assistant).
 */
export class SessionCompactor {
  private readonly maxTokens: number;
  private readonly outputReserveRatio: number;
  private readonly summaryMaxTokens: number;

  constructor(options: CompactionOptions = {}) {
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.outputReserveRatio = options.outputReserveRatio ?? DEFAULT_OUTPUT_RESERVE;
    this.summaryMaxTokens = options.summaryMaxTokens ?? DEFAULT_SUMMARY_MAX_TOKENS;
  }

  /**
   * Check if compaction is needed and return a compacted session if so.
   * Returns the original session if under budget.
   */
  compact(session: Session): Session {
    const inputBudget = Math.floor(this.maxTokens * (1 - this.outputReserveRatio));
    const currentTokens = estimateMessageTokens(session.messages) + FRAMING_OVERHEAD;

    if (currentTokens <= inputBudget) {
      return session;
    }

    return this.applyCompaction(session, inputBudget);
  }

  private applyCompaction(session: Session, budget: number): Session {
    const messages = [...session.messages];

    // Preserve first message (system setup / initial user message)
    const preserveCount = Math.min(2, messages.length);
    const preserved = messages.slice(0, preserveCount);
    let remaining = messages.slice(preserveCount);

    // Tier 1: Trim oldest messages from the middle
    while (remaining.length > 2) {
      const totalTokens =
        estimateMessageTokens(preserved) +
        estimateMessageTokens(remaining) +
        FRAMING_OVERHEAD;
      if (totalTokens <= budget) break;

      // Remove oldest message from remaining
      remaining = remaining.slice(2); // drop a user+assistant pair
    }

    let compacted = [...preserved, ...remaining];

    // Tier 2: If still over budget, replace middle messages with a summary
    if (estimateMessageTokens(compacted) + FRAMING_OVERHEAD > budget && compacted.length > preserveCount + 2) {
      const middle = compacted.slice(preserveCount, -2);
      const tail = compacted.slice(-2);
      const summary = this.summarizeMessages(middle);
      compacted = [...preserved, summary, ...tail];
    }

    // Tier 3: Truncate to just the tail
    if (estimateMessageTokens(compacted) + FRAMING_OVERHEAD > budget) {
      compacted = compacted.slice(-4); // keep at most last 4 messages
    }

    return {
      ...session,
      messages: compacted,
      updatedAt: new Date(),
    };
  }

  /**
   * Creates a summary message from a list of dropped messages.
   * In production this would call an LLM; here it uses a heuristic.
   */
  private summarizeMessages(messages: Message[]): Message {
    const topicHints: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'user' && msg.content.length < 200) {
        topicHints.push(msg.content.slice(0, 80));
      }
    }

    const summaryContent =
      topicHints.length > 0
        ? `[Previous conversation summary: ${topicHints.slice(0, 5).join(' | ')}]`
        : `[${messages.length} earlier messages compacted for context window]`;

    return {
      id: nanoid(),
      role: 'user',
      content: summaryContent.slice(0, this.summaryMaxTokens * 4), // chars ≈ tokens * 4
      createdAt: new Date(),
      isMeta: true,
    };
  }

  /**
   * Get the current token budget information.
   */
  getBudget(): { maxTokens: number; inputBudget: number; outputReserve: number } {
    const inputBudget = Math.floor(this.maxTokens * (1 - this.outputReserveRatio));
    return {
      maxTokens: this.maxTokens,
      inputBudget,
      outputReserve: Math.floor(this.maxTokens * this.outputReserveRatio),
    };
  }
}
