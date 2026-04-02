import type { RiskLevel, ToolCall } from '@freed/shared';

export type ApprovalHandler = (toolCall: ToolCall, riskLevel: RiskLevel) => Promise<boolean>;

/**
 * Decides whether a tool call requires human approval and delegates to a
 * user-provided handler for 'ask' level actions.
 */
export class ApprovalEngine {
  private readonly handler: ApprovalHandler;

  constructor(handler: ApprovalHandler) {
    this.handler = handler;
  }

  async check(toolCall: ToolCall, riskLevel: RiskLevel): Promise<boolean> {
    switch (riskLevel) {
      case 'safe':
        return true;

      case 'ask':
        return this.handler(toolCall, riskLevel);

      case 'deny':
        return false;
    }
  }
}

/**
 * A no-op approval handler that auto-approves everything.
 * Useful for automated mode or tests.
 */
export const autoApprove: ApprovalHandler = async () => true;

/**
 * A strict approval handler that auto-denies all non-safe actions.
 */
export const autoDeny: ApprovalHandler = async () => false;
