import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

// Use hoisted to ensure mock is set up before config-loader module loads
const { mockExistsSync, mockReadFileSync } = vi.hoisted(() => {
  const mockFs = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
  return {
    mockExistsSync: mockFs.existsSync,
    mockReadFileSync: mockFs.readFileSync,
  };
});

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

import { loadMCPConfig } from '../mcp/config-loader.js';

describe('loadMCPConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty config when no files exist', () => {
    mockExistsSync.mockReturnValue(false);
    const config = loadMCPConfig();
    expect(config.servers).toEqual([]);
  });

  it('merges project config overriding global', () => {
    const globalConfig = JSON.stringify({
      servers: [
        { name: 'server1', command: '/usr/bin/global-server' },
        { name: 'server2', url: 'http://global.com' },
      ],
    });
    const projectConfig = JSON.stringify({
      servers: [
        { name: 'server2', url: 'http://project.com' },
        { name: 'server3', command: '/usr/bin/project-server' },
      ],
    });

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync
      .mockReturnValueOnce(globalConfig)
      .mockReturnValueOnce(projectConfig);

    const config = loadMCPConfig('/project');
    expect(config.servers).toHaveLength(3);
    const server2 = config.servers.find((s) => s.name === 'server2');
    expect(server2?.url).toBe('http://project.com');
  });

  it('logs warning for malformed JSON', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json{');

    const config = loadMCPConfig();
    expect(config.servers).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
