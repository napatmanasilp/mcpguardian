"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BreadcrumbSegment {
  label: string;
  href?: string; // undefined for the current page (last segment)
}

interface BreadcrumbNavProps {
  segments: BreadcrumbSegment[];
}

/**
 * Truncates a label to a maximum of 30 characters, adding an ellipsis if exceeded.
 */
function truncateLabel(label: string, maxLength = 30): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength) + "\u2026";
}

/**
 * BreadcrumbNav renders a breadcrumb trail for nested routes.
 *
 * - Only displays when segments.length > 1 (nested routes deeper than 1 segment)
 * - Ancestor segments are clickable links
 * - Last segment is rendered as non-clickable muted text
 * - Dynamic names are truncated at 30 characters with ellipsis
 * - Wrapped in <nav aria-label="Breadcrumb"> with <ol> for screen reader support
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
export const BreadcrumbNav = ({ segments }: BreadcrumbNavProps) => {
  // Only display on nested routes (deeper than 1 segment)
  if (segments.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const displayLabel = truncateLabel(segment.label);

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="size-3.5 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
              )}
              {isLast || !segment.href ? (
                <span
                  className={cn(
                    "text-muted-foreground",
                    isLast && "font-medium"
                  )}
                  aria-current={isLast ? "page" : undefined}
                  title={segment.label.length > 30 ? segment.label : undefined}
                >
                  {displayLabel}
                </span>
              ) : (
                <Link
                  href={segment.href}
                  className="text-slate-400 transition-colors hover:text-slate-200 hover:underline"
                  title={segment.label.length > 30 ? segment.label : undefined}
                >
                  {displayLabel}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
