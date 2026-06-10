import { CrossServerRisk, ServerResult } from './types';

const CROSS_REFERENCE_PATTERNS = [
  /when\s+using\s+\S+/i,
  /before\s+calling\s+\S+/i,
  /instead\s+of\s+\S+/i,
  /ignore\s+previous/i,
  /disregard\s+(the\s+)?(above|prior)/i,
  /use\s+\S+\s+(instead|rather)/i,
  /don'?t\s+(use|call|run)\s+\S+/i,
  /never\s+(use|call|run)\s+\S+/i,
  /overr?ide\s+\S+/i,
];

function getToolNames(server: ServerResult): string[] {
  if (!server.rawTools || !Array.isArray(server.rawTools)) return [];
  return server.rawTools
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map(t => typeof t.name === 'string' ? t.name : '')
    .filter(Boolean);
}

function getToolDescriptions(server: ServerResult): string[] {
  if (!server.rawTools || !Array.isArray(server.rawTools)) return [];
  return server.rawTools
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map(t => typeof t.description === 'string' ? t.description : '')
    .filter(Boolean);
}

export function analyzeCrossServerRisks(servers: ServerResult[], serverNames: string[]): {
  risks: CrossServerRisk[];
  extraDeduction: number;
} {
  const risks: CrossServerRisk[] = [];
  let extraDeduction = 0;

  if (servers.length < 2) return { risks, extraDeduction };

  // ── Tool shadowing ──────────────────────────────────────────────────
  const toolToServers = new Map<string, string[]>();

  for (const server of servers) {
    const toolNames = getToolNames(server);
    for (const toolName of toolNames) {
      const existing = toolToServers.get(toolName) || [];
      existing.push(server.name);
      toolToServers.set(toolName, existing);
    }
  }

  for (const [toolName, collidingServers] of toolToServers) {
    if (collidingServers.length >= 2) {
      risks.push({
        type: 'TOOL_SHADOWING_RISK',
        severity: 'CRITICAL',
        title: 'Tool shadowing risk — same tool name exposed by multiple servers',
        description: `Tool "${toolName}" is exposed by servers: ${collidingServers.join(', ')}. The agent may route calls to the wrong server, as all tools are loaded into a flat namespace. First registered: ${collidingServers[0]}.`,
        fix: 'Rename tools to avoid collisions across servers, or use server-scoped tool calls with explicit server routing.',
        deduction: 35,
      });
      extraDeduction += 35;
    }
  }

  // ── Cross-server manipulation ───────────────────────────────────────
  const allToolNames = new Set<string>();
  for (const server of servers) {
    for (const name of getToolNames(server)) {
      allToolNames.add(name);
    }
  }
  const allServerNames = new Set(serverNames);

  for (const server of servers) {
    const descriptions = getToolDescriptions(server);
    for (const desc of descriptions) {
      const lowerDesc = desc.toLowerCase();

      for (const pattern of CROSS_REFERENCE_PATTERNS) {
        if (pattern.test(lowerDesc)) {
          risks.push({
            type: 'CROSS_SERVER_MANIPULATION',
            severity: 'CRITICAL',
            title: 'Cross-server manipulation — tool description references other tools behavior',
            description: `Server "${server.name}" has a tool description containing cross-referencing language: "${pattern.source}". This can manipulate the agent's behavior with tools from other servers.`,
            fix: 'Remove cross-referencing instructions from tool descriptions. Each tool should describe its own behavior in isolation.',
            deduction: 30,
          });
          extraDeduction += 30;
          break;
        }
      }

      for (const otherName of allServerNames) {
        if (otherName !== server.name && lowerDesc.includes(otherName.toLowerCase())) {
          risks.push({
            type: 'CROSS_SERVER_MANIPULATION',
            severity: 'CRITICAL',
            title: 'Cross-server manipulation — tool description references another server',
            description: `Server "${server.name}" has a tool description that mentions another server "${otherName}". This can manipulate the agent into routing calls or changing behavior.`,
            fix: 'Remove references to other servers from tool descriptions.',
            deduction: 30,
          });
          extraDeduction += 30;
          break;
        }
      }
    }
  }

  // ── Compound risk score ─────────────────────────────────────────────
  if (servers.length >= 3) {
    const compoundPenalty = (servers.length - 2) * 10;
    risks.push({
      type: 'MULTI_SERVER_COMPOUND_RISK',
      severity: 'MEDIUM',
      title: 'Multi-server compound risk — attack surface increases with connected servers',
      description: `Configuration connects ${servers.length} servers. With 3+ MCP servers, Unit 42 research shows 78.3% attack success rate via cross-server exploitation. Each additional server beyond 2 adds 10 points of compound risk.`,
      fix: 'Minimize the number of connected MCP servers. Use only trusted servers and isolate them by purpose.',
      deduction: 0,
    });
    extraDeduction += compoundPenalty;
  }

  return { risks, extraDeduction };
}
