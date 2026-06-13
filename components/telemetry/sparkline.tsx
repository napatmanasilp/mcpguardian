"use client";

export interface SparklineProps {
  /** Latency values in ms, oldest first */
  data: number[];
  /** SVG width in px */
  width?: number;
  /** SVG height in px */
  height?: number;
  /** Stroke color — defaults to the --secure design token */
  color?: string;
}

/**
 * Lightweight SVG sparkline rendered left-to-right (oldest → newest).
 * Uses a simple polyline — no chart library needed.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "var(--secure)",
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="No data"
      />
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1; // avoid division by zero when all values are equal

  const padding = 2; // small vertical padding so strokes aren't clipped
  const chartHeight = height - padding * 2;

  const points = data
    .map((value, index) => {
      const x =
        data.length === 1
          ? width / 2
          : (index / (data.length - 1)) * width;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Latency sparkline"
      className="shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
