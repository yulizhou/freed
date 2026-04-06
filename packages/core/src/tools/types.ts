import type { RiskLevel, ToolResult } from '../shared/index.js';

export interface ToolDefinition<TInput = Record<string, unknown>> {
  name: string;
  description: string;
  /** JSON Schema object for input validation */
  inputSchema: Record<string, unknown>;
  riskLevel: RiskLevel;
  execute(input: TInput, cwd?: string): Promise<ToolResult>;
}

export type AnyToolDefinition = ToolDefinition<Record<string, unknown>>;
