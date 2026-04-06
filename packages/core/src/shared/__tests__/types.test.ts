import { describe, it, expect } from 'vitest';
import {
  RiskLevelSchema,
  ToolResultSchema,
  MessageSchema,
  AgentProfileSchema,
  MemoryEntrySchema,
  FreedError,
  ErrorCode,
  EnvContextSchema,
} from '../types.js';

describe('RiskLevelSchema', () => {
  it('should accept valid risk levels', () => {
    expect(RiskLevelSchema.parse('safe')).toBe('safe');
    expect(RiskLevelSchema.parse('ask')).toBe('ask');
    expect(RiskLevelSchema.parse('deny')).toBe('deny');
  });

  it('should reject invalid risk levels', () => {
    expect(() => RiskLevelSchema.parse('unknown')).toThrow();
  });
});

describe('ToolResultSchema', () => {
  it('should parse a success result', () => {
    const result = ToolResultSchema.parse({ success: true, output: 'done' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('done');
    expect(result.error).toBeUndefined();
  });

  it('should parse a failure result with error', () => {
    const result = ToolResultSchema.parse({ success: false, output: '', error: 'Something went wrong' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });
});

describe('MessageSchema', () => {
  it('should parse a user message', () => {
    const msg = MessageSchema.parse({
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      createdAt: new Date(),
    });
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('should reject invalid role', () => {
    expect(() =>
      MessageSchema.parse({
        id: 'msg-1',
        role: 'system',
        content: 'Hello',
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});

describe('AgentProfileSchema', () => {
  it('should parse a valid agent profile', () => {
    const profile = AgentProfileSchema.parse({
      id: 'coder',
      name: 'Coder',
      model: 'anthropic/claude-opus-4-5',
      systemPrompt: 'You are a helpful coder.',
      tools: ['shell', 'read_file'],
    });
    expect(profile.id).toBe('coder');
    expect(profile.tools).toHaveLength(2);
  });

  it('should reject temperature out of range', () => {
    expect(() =>
      AgentProfileSchema.parse({
        id: 'coder',
        name: 'Coder',
        model: 'openai/gpt-4',
        systemPrompt: 'You are helpful.',
        tools: [],
        temperature: 3,
      }),
    ).toThrow();
  });
});

describe('MemoryEntrySchema', () => {
  it('should parse a valid memory entry', () => {
    const entry = MemoryEntrySchema.parse({
      id: 'mem-1',
      scope: 'project',
      content: 'Use pnpm for package management.',
      tags: ['tooling'],
      updatedAt: new Date(),
    });
    expect(entry.scope).toBe('project');
    expect(entry.tags).toContain('tooling');
  });
});

describe('FreedError', () => {
  it('should create an error with code and message', () => {
    const err = new FreedError(ErrorCode.TOOL_NOT_FOUND, 'Tool shell not found');
    expect(err.code).toBe('TOOL_NOT_FOUND');
    expect(err.message).toBe('Tool shell not found');
    expect(err.name).toBe('FreedError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should store cause', () => {
    const cause = new Error('original');
    const err = new FreedError(ErrorCode.MODEL_ERROR, 'Model failed', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('EnvContextSchema', () => {
  it('should parse a valid env context with optional git fields', () => {
    const ctx = EnvContextSchema.parse({
      os: 'darwin',
      shell: '/bin/zsh',
      cwd: '/home/user/project',
      nodeVersion: '22.0.0',
      gitBranch: 'main',
      gitChangedFiles: ['src/index.ts'],
    });
    expect(ctx.os).toBe('darwin');
    expect(ctx.gitBranch).toBe('main');
  });

  it('should parse without optional git fields', () => {
    const ctx = EnvContextSchema.parse({
      os: 'linux',
      shell: '/bin/bash',
      cwd: '/tmp',
      nodeVersion: '22.0.0',
    });
    expect(ctx.gitBranch).toBeUndefined();
  });
});
