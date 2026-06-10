import { Issue } from './types';

export interface ToolDiff {
  added: string[];
  removed: string[];
  modified: { name: string; oldDesc: string; newDesc: string }[];
}

function sortedStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(sortedStringify).join(',')}]`;
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${sortedStringify((obj as Record<string, unknown>)[k])}`).join(',')}}`;
}

export async function computeConfigHash(configJson: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(configJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function computeToolsHash(tools: unknown[]): Promise<string> {
  const sorted = sortedStringify(tools);
  const encoder = new TextEncoder();
  const data = encoder.encode(sorted);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function computeToolDiff(oldTools: unknown[], newTools: unknown[]): ToolDiff {
  const oldByName = new Map<string, Record<string, unknown>>();
  const newByName = new Map<string, Record<string, unknown>>();

  for (const t of oldTools) {
    const tool = t as Record<string, unknown>;
    if (typeof tool.name === 'string') oldByName.set(tool.name, tool);
  }
  for (const t of newTools) {
    const tool = t as Record<string, unknown>;
    if (typeof tool.name === 'string') newByName.set(tool.name, tool);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const modified: { name: string; oldDesc: string; newDesc: string }[] = [];

  for (const [name, newTool] of newByName) {
    if (!oldByName.has(name)) {
      added.push(name);
    } else {
      const oldTool = oldByName.get(name)!;
      if (sortedStringify(oldTool) !== sortedStringify(newTool)) {
        modified.push({
          name,
          oldDesc: String(oldTool.description ?? ''),
          newDesc: String(newTool.description ?? ''),
        });
      }
    }
  }

  for (const [name] of oldByName) {
    if (!newByName.has(name)) {
      removed.push(name);
    }
  }

  return { added, removed, modified };
}

export function generateRugPullIssue(
  serverUrl: string,
  diff: ToolDiff,
  priorHash: string,
  currentHash: string,
): Issue {
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`Added: ${diff.added.join(', ')}`);
  if (diff.removed.length > 0) parts.push(`Removed: ${diff.removed.join(', ')}`);
  if (diff.modified.length > 0) parts.push(`Modified: ${diff.modified.map(m => `${m.name}`).join(', ')}`);
  const diffDesc = parts.join('; ');

  return {
    type: 'RUG_PULL_DETECTED',
    severity: 'CRITICAL',
    title: 'Tool definition rug-pull detected — server changed its tools since last scan',
    description: `Server at ${serverUrl} changed tool definitions. Hash ${priorHash.slice(0, 12)} → ${currentHash.slice(0, 12)}. ${diffDesc}.`,
    fix: 'Review the tool changes carefully. If unexpected, disconnect this server immediately. Rug-pull attacks are a top-2026 MCP attack vector.',
    deduction: 40,
    diff,
  };
}
