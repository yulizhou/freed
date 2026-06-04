import type { RiskLevel, ToolResult } from '../shared/index.js';

export interface ToolDefinition<TInput = Record<string, unknown>> {
  name: string;
  description: string;
  /** JSON Schema object for input validation */
  inputSchema: Record<string, unknown>;
  riskLevel: RiskLevel;
  execute(input: TInput, cwd?: string): Promise<ToolResult>;

  /** Maximum execution duration in milliseconds (default: 30000). */
  maxDuration?: number;

  /**
   * Maximum retry attempts on transient failures (default: 2).
   * Only transient errors (network, rate limit, 5xx) are retried.
   */
  maxRetries?: number;

}

export type AnyToolDefinition = ToolDefinition<Record<string, unknown>>;

/** Default timeout durations by tool category. */
export const DEFAULT_TIMEOUTS: Record<string, number> = {
  shell: 120_000,
  default: 30_000,
};
