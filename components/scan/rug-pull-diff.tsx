"use client";

import { cn } from "@/lib/utils";

interface RugPullDiffProps {
  diff: {
    added: string[];
    removed: string[];
    modified: Array<{ name: string; oldDesc: string; newDesc: string }>;
  };
}

export function RugPullDiff({ diff }: RugPullDiffProps) {
  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0;
  if (!hasChanges) return null;

  return (
    <div className="space-y-2">
      {/* ADDED */}
      {diff.added.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
          <p className="mb-1.5 text-[10px] font-mono font-bold tracking-wider text-emerald-400">
            + TOOLS ADDED
          </p>
          <div className="space-y-1">
            {diff.added.map((name) => (
              <div
                key={name}
                className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-mono text-emerald-300"
              >
                + {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REMOVED */}
      {diff.removed.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5">
          <p className="mb-1.5 text-[10px] font-mono font-bold tracking-wider text-red-400">
            - TOOLS REMOVED
          </p>
          <div className="space-y-1">
            {diff.removed.map((name) => (
              <div
                key={name}
                className="rounded bg-red-500/10 px-2.5 py-1 text-xs font-mono text-red-300"
              >
                - {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODIFIED */}
      {diff.modified.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
          <p className="mb-1.5 text-[10px] font-mono font-bold tracking-wider text-amber-400">
            ~ TOOLS MODIFIED
          </p>
          <div className="space-y-2">
            {diff.modified.map(({ name, oldDesc, newDesc }) => (
              <div key={name}>
                <p className="mb-1 text-[10px] font-mono font-semibold text-slate-400">{name}</p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="rounded bg-red-500/10 p-1.5 text-red-300 line-clamp-3">
                    {oldDesc || "(empty)"}
                  </div>
                  <div className="rounded bg-emerald-500/10 p-1.5 text-emerald-300 line-clamp-3">
                    {newDesc || "(empty)"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
