"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * NavProgressBar – Top-of-page navigation progress indicator.
 *
 * Detects route changes via usePathname/useSearchParams in Next.js App Router.
 * Animates a 2px bar from 0% → 90% while loading, then completes to 100%
 * when the new page mounts. Uses the --monitor design token (blue) for color.
 *
 * If loading exceeds 10 seconds, the bar stays visible at 90% until the
 * page finishes loading or an error boundary renders.
 *
 * Requirements: 14.1, 14.4, 14.5
 */

export function NavProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const [completing, setCompleting] = useState(false);

  const prevPathRef = useRef(pathname + searchParams.toString());
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  const cleanup = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (completionTimeoutRef.current !== null) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }, []);

  // Start the progress animation toward 90%
  const startProgress = useCallback(() => {
    cleanup();
    setVisible(true);
    setCompleting(false);
    setWidth(0);
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const maxDuration = 10000; // 10 seconds cap (req 14.5)
      const t = Math.min(elapsed / maxDuration, 1);
      // Ease-out cubic: fast start, slows as it approaches 90%
      const eased = 90 * (1 - Math.pow(1 - t, 3));
      setWidth(eased);

      // If t < 1, keep animating; at t=1 bar stays at 90% (req 14.5)
      if (t < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
  }, [cleanup]);

  // Complete the bar to 100% and hide it
  const completeProgress = useCallback(() => {
    cleanup();
    setCompleting(true);
    setWidth(100);

    completionTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
      setCompleting(false);
    }, 400);
  }, [cleanup]);

  // Intercept link clicks to start the bar before navigation completes
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Only handle internal navigation links
      if (href.startsWith("/") || href.startsWith(window.location.origin)) {
        // Skip if it's the current path
        const currentKey = pathname + searchParams.toString();
        const targetPath = href.startsWith("/")
          ? href
          : new URL(href).pathname + new URL(href).search;

        if (targetPath !== currentKey) {
          startProgress();
        }
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname, searchParams, startProgress]);

  // Detect when navigation completes (pathname/searchParams change)
  useEffect(() => {
    // Skip the initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const currentKey = pathname + searchParams.toString();
    if (currentKey !== prevPathRef.current) {
      prevPathRef.current = currentKey;
      // Navigation completed — finish the bar
      if (visible) {
        completeProgress();
      }
    }
  }, [pathname, searchParams, visible, completeProgress]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
      className="fixed inset-x-0 top-0 z-[9999] h-[2px]"
    >
      <div
        className="h-full"
        style={{
          width: `${width}%`,
          backgroundColor: "var(--monitor)",
          transition: completing
            ? "width 200ms ease-out, opacity 300ms ease-out 100ms"
            : "none",
          opacity: completing ? 0 : 1,
        }}
      />
    </div>
  );
}
