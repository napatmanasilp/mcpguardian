import { describe, it, expect } from 'vitest';
import { scanMcpConfig } from '../index';

describe('scanMcpConfig', () => {
  it('returns grade A with score 100 for clean HTTPS config', () => {
    const config = JSON.stringify({
      mcpServers: {
        api: {
          url: 'https://api.example.com/mcp',
        },
      },
    });
    const result = scanMcpConfig(config);
    expect(result.grade).toBe('A');
    expect(result.score).toBe(100);
    expect(result.serversScanned).toBe(1);
    expect(result.criticalIssues).toBe(0);
    expect(result.highIssues).toBe(0);
    expect(result.mediumIssues).toBe(0);
  });

  it('detects CRITICAL issue when AWS key is in env', () => {
    const config = JSON.stringify({
      mcpServers: {
        storage: {
          command: 'node',
          args: ['server.js'],
          env: {
            AWS_KEY: 'AKIAIOSFODNN7EXAMPLE',
          },
        },
      },
    });
    const result = scanMcpConfig(config);
    expect(result.criticalIssues).toBeGreaterThanOrEqual(1);
    const server = result.servers[0];
    const hasSecretIssue = server.issues.some(i => i.type === 'HARDCODED_SECRETS');
    expect(hasSecretIssue).toBe(true);
  });

  it('detects HIGH STDIO_TRANSPORT issue for command+args config', () => {
    const config = JSON.stringify({
      mcpServers: {
        shell: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
        },
      },
    });
    const result = scanMcpConfig(config);
    const server = result.servers[0];
    const hasStdioIssue = server.issues.some(i => i.type === 'STDIO_TRANSPORT');
    expect(hasStdioIssue).toBe(true);
    expect(result.highIssues).toBeGreaterThanOrEqual(1);
  });

  it('detects UNRESTRICTED_FILESYSTEM issue for filesystem server without --directory', () => {
    const config = JSON.stringify({
      mcpServers: {
        'server-filesystem': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/some/path'],
        },
      },
    });
    const result = scanMcpConfig(config);
    const server = result.servers[0];
    const hasFilesystemIssue = server.issues.some(i => i.type === 'UNRESTRICTED_FILESYSTEM');
    expect(hasFilesystemIssue).toBe(true);
  });

  it('does not detect UNRESTRICTED_FILESYSTEM when --directory flag is present', () => {
    const config = JSON.stringify({
      mcpServers: {
        fs: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '--directory', '/allowed/path'],
        },
      },
    });
    const result = scanMcpConfig(config);
    const server = result.servers[0];
    const hasFilesystemIssue = server.issues.some(i => i.type === 'UNRESTRICTED_FILESYSTEM');
    expect(hasFilesystemIssue).toBe(false);
  });

  it('calculates average score correctly for two servers (one clean, one dirty)', () => {
    const config = JSON.stringify({
      mcpServers: {
        clean: {
          url: 'https://api.example.com/mcp',
        },
        dirty: {
          command: 'npx',
          args: ['server.js'],
          env: {
            SECRET: 'AKIAIOSFODNN7EXAMPLE',
          },
        },
      },
    });
    const result = scanMcpConfig(config);
    expect(result.serversScanned).toBe(2);
    const cleanServer = result.servers.find(s => s.name === 'clean')!;
    const dirtyServer = result.servers.find(s => s.name === 'dirty')!;
    expect(cleanServer.score).toBe(100);
    expect(dirtyServer.score).toBeLessThan(100);
    const expectedAverage = Math.round((cleanServer.score + dirtyServer.score) / 2);
    expect(result.score).toBe(expectedAverage);
  });

  it('throws error with "Invalid JSON" for invalid JSON string', () => {
    expect(() => scanMcpConfig('not json')).toThrow('Invalid JSON');
  });
});