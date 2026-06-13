import { cn } from "@/lib/utils";

export interface SkeletonBlock {
  type: "card" | "table" | "chart" | "header";
  height: string;
}

export interface PageSkeletonProps {
  blocks: SkeletonBlock[];
}

/**
 * PageSkeleton renders shimmer-animated skeleton placeholders that approximate
 * the layout of a page while it loads. Used in `loading.tsx` files across routes.
 *
 * - Uses `--bg-surface` design token for the skeleton element background.
 * - Applies `.shimmer` CSS class for a 1.5s animation cycle.
 * - Animation is automatically disabled when `prefers-reduced-motion: reduce` is enabled
 *   (handled by the global `.shimmer` CSS rule).
 */
export function PageSkeleton({ blocks }: PageSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 p-6 w-full" aria-busy="true" aria-label="Loading page content">
      {blocks.map((block, index) => (
        <SkeletonBlockElement key={index} block={block} />
      ))}
    </div>
  );
}

function SkeletonBlockElement({ block }: { block: SkeletonBlock }) {
  const baseClasses = "w-full rounded-lg shimmer";
  const style = {
    height: block.height,
    backgroundColor: "var(--bg-surface)",
  };

  switch (block.type) {
    case "header":
      return (
        <div className="flex flex-col gap-2">
          <div
            className={cn(baseClasses, "max-w-[300px]")}
            style={{ ...style, height: "2rem" }}
          />
          <div
            className={cn(baseClasses, "max-w-[500px]")}
            style={{ ...style, height: "1rem" }}
          />
        </div>
      );

    case "card":
      return (
        <div
          className={cn(baseClasses, "border border-white/5")}
          style={style}
        />
      );

    case "table":
      return (
        <div className="flex flex-col gap-2" style={{ height: block.height }}>
          {/* Table header */}
          <div
            className={cn(baseClasses)}
            style={{ height: "2.5rem", backgroundColor: "var(--bg-surface)" }}
          />
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(baseClasses)}
              style={{ height: "3rem", backgroundColor: "var(--bg-surface)", opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
      );

    case "chart":
      return (
        <div
          className={cn(baseClasses, "border border-white/5")}
          style={style}
        />
      );

    default:
      return (
        <div
          className={cn(baseClasses)}
          style={style}
        />
      );
  }
}
