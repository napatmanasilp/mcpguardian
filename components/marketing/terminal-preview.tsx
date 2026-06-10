"use client";

import { useEffect, useState } from "react";

const LINES = [
  { text: "$ mcpguardian scan ./mcp-config.json", className: "text-slate-300" },
  { text: "", className: "" },
  { text: "  Probing 3 servers...", className: "text-slate-400", suffix: " ✓", suffixClass: "text-emerald-400" },
  { text: "  Checking tool definitions...", className: "text-slate-400", suffix: " ✓", suffixClass: "text-emerald-400" },
  { text: "  Cross-referencing CVEs...", className: "text-slate-400", suffix: " ✓", suffixClass: "text-emerald-400" },
  { text: "  Analyzing cross-server risks...", className: "text-slate-400", suffix: " ✓", suffixClass: "text-emerald-400" },
  { text: "", className: "" },
  { text: "  SECURITY SCORE   45/100  D", className: "text-orange-400 font-bold" },
  { text: "", className: "" },
  { text: "  🔴 CRITICAL  TOOL_POISONING_RISK", className: "text-red-400 text-xs" },
  { text: "  🔴 CRITICAL  MISSING_AUTHENTICATION", className: "text-red-400 text-xs" },
  { text: "  🟠 HIGH      VULNERABLE_PACKAGE", className: "text-orange-400 text-xs" },
  { text: "  🟠 HIGH      STDIO_TRANSPORT", className: "text-orange-400 text-xs" },
  { text: "", className: "" },
  { text: "  ⚠  MCP03 MCP04 MCP05 MCP07 flagged", className: "text-amber-400 text-xs" },
];

export function TerminalPreview() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= LINES.length) {
      // All lines shown — wait 3 seconds then restart
      const timer = setTimeout(() => setVisibleCount(0), 3000);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setVisibleCount((c) => c + 1), 400);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  // Show a blinking cursor when animation is running
  const showCursor = visibleCount > 0 && visibleCount < LINES.length;

  return (
    <div className="p-5 font-mono text-sm space-y-1.5 min-h-[320px]">
      {LINES.slice(0, visibleCount).map((line, i) => (
        <div key={i} className={line.className || "h-2"}>
          {line.text}
          {line.suffix && i === visibleCount - 1 && (
            <span className={line.suffixClass}>{line.suffix}</span>
          )}
        </div>
      ))}
      {showCursor && (
        <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />
      )}
    </div>
  );
}
