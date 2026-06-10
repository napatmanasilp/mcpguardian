export const SEVERITY_COLORS = {
  CRITICAL: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
  HIGH: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    dot: 'bg-orange-500',
    glow: 'shadow-orange-500/20',
  },
  MEDIUM: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500',
    glow: 'shadow-amber-500/20',
  },
  LOW: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-500',
    glow: 'shadow-blue-500/20',
  },
  INFO: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-500',
    glow: 'shadow-slate-500/20',
  },
} as const

export const GRADE_STYLES = {
  A: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', glow: 'shadow-emerald-500/25' },
  B: { bg: 'bg-blue-500/15', text: 'text-blue-400', ring: 'ring-blue-500/30', glow: 'shadow-blue-500/25' },
  C: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30', glow: 'shadow-amber-500/25' },
  D: { bg: 'bg-orange-500/15', text: 'text-orange-400', ring: 'ring-orange-500/30', glow: 'shadow-orange-500/25' },
  F: { bg: 'bg-red-500/15', text: 'text-red-400', ring: 'ring-red-500/30', glow: 'shadow-red-500/25' },
} as const

export const OWASP_COLORS: Record<string, string> = {
  MCP01: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  MCP02: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  MCP03: 'text-red-400 bg-red-500/10 border-red-500/30',
  MCP04: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  MCP05: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  MCP06: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  MCP07: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  MCP08: 'text-lime-400 bg-lime-500/10 border-lime-500/30',
  MCP09: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  MCP10: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
}

export const OWASP_LABELS: Record<string, string> = {
  MCP01: 'Token Exposure',
  MCP02: 'Privilege Escalation',
  MCP03: 'Tool Poisoning',
  MCP04: 'Supply Chain',
  MCP05: 'Command Injection',
  MCP06: 'Intent Subversion',
  MCP07: 'Missing Auth',
  MCP08: 'Audit Gaps',
  MCP09: 'Shadow Servers',
  MCP10: 'Context Oversharing',
}
