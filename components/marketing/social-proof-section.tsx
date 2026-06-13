"use client";

import { useEffect, useState } from "react";



// ─── CountUp Animation ─────────────────────────────────────────────────

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const step = Math.max(1, Math.ceil(value / 40));
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, value);
      setDisplay(Math.round(current));
      if (current >= value) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <>
      {display.toLocaleString()}
      {suffix}
    </>
  );
}

// ─── Component ─────────────────────────────────────────────────────────

export const SocialProofSection = () => {
  const [stats, setStats] = useState<{
    scans: number;
    cves: number;
    rugPulls: number;
    monitors: number;
  } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // silently fail — static fallback below
      }
    };
    fetchStats();
  }, []);

  const statItems = [
    {
      value: stats?.scans ?? 0,
      label: "MCP servers scanned",
      floor: 0,
    },
    {
      value: stats?.rugPulls ?? 0,
      label: "Rug pulls detected",
      floor: 0,
    },
    {
      // CVEs are seeded — always show at least 26
      value: Math.max(stats?.cves ?? 0, 26),
      label: "CVEs tracked",
      floor: 26,
    },
    {
      value: stats?.monitors ?? 0,
      label: "Configs monitored",
      floor: 0,
    },
  ];

  return (
    <section className="border-b border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-center text-xs font-mono text-slate-500 uppercase tracking-widest mb-8">
          Trusted by security teams worldwide
        </p>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {statItems.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight tabular-nums text-slate-200">
                {stats ? (
                  <CountUp value={stat.value} />
                ) : (
                  <span>0</span>
                )}
              </p>
              <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
