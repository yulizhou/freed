import { describe, it, expect, vi } from 'vitest';
import { ApprovalEngine, autoApprove, autoDeny } from '../approval-engine.js';
import type { ToolCall } from '../../shared/index.js';

const mockToolCall: ToolCall = { id: 'tc-1', name: 'shell', input: { command: 'rm -rf /tmp/test' } };

describe('ApprovalEngine', () => {
  it('should approve safe tool calls without calling handler', async () => {
    const handler = vi.fn().mockResolvedValue(true);
    const engine = new ApprovalEngine(handler);
    const result = await engine.check(mockToolCall, 'safe');
    expect(result).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should call handler for ask level and return its result', async () => {
    const handler = vi.fn().mockResolvedValue(true);
    const engine = new ApprovalEngine(handler);
    const result = await engine.check(mockToolCall, 'ask');
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should deny without calling handler for deny level', async () => {
    const handler = vi.fn().mockResolvedValue(true);
    const engine = new ApprovalEngine(handler);
    const result = await engine.check(mockToolCall, 'deny');
    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should respect handler returning false', async () => {
    const handler = vi.fn().mockResolvedValue(false);
    const engine = new ApprovalEngine(handler);
    const result = await engine.check(mockToolCall, 'ask');
    expect(result).toBe(false);
  });
});

describe('autoApprove', () => {
  it('should always return true', async () => {
    expect(await autoApprove(mockToolCall, 'ask')).toBe(true);
  });
});

describe('autoDeny', () => {
  it('should always return false', async () => {
    expect(await autoDeny(mockToolCall, 'ask')).toBe(false);
  });
});
