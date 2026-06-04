import type { Message } from '../shared/index.js';

/**
 * Estimates token count using characters ÷ 4 heuristic.
 * This is a fast approximation that works across models without
 * pulling in heavy dependencies like tiktoken.
 *
 * Accuracy: typically within ±20% of real token counts for English text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens across an array of messages.
 * Includes a small per-message framing overhead (4 tokens).
 */
export function estimateMessageTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    // Per-message framing overhead (role marker, separators)
    total += 4;
    total += estimateTokens(msg.content);
    if (msg.toolResult) {
      total += estimateTokens(msg.toolResult.output);
      if (msg.toolResult.error) {
        total += estimateTokens(msg.toolResult.error);
      }
    }
  }
  return total;
}
