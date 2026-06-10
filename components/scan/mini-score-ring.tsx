"use client";

import type { Grade } from "@/lib/scanner/types";

interface MiniScoreRingProps {
  grade: Grade;
  score: number;
  size?: number;
}

export function MiniScoreRing({ grade, score, size = 40 }: MiniScoreRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const gradeToHex: Record<string, string> = {
    A: "#10b981",
    B: "#3b82f6",
    C: "#f59e0b",
    D: "#f97316",
    F: "#ef4444",
  };
  const color = gradeToHex[grade] ?? "#ef4444";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-white/10"
        strokeWidth="4"
      />
      {/* Animated score arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-1000 ease-out"
        style={{ filter: `drop-shadow(0 0 3px ${color}40)` }}
      />
      {/* Grade letter */}
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-black"
        fill={color}
        style={{ fontSize: size * 0.55 }}
      >
        {grade}
      </text>
    </svg>
  );
}
