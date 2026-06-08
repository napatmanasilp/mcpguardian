export type SecurityGrade = "A" | "B" | "C" | "D" | "F";

export const gradeColors: Record<
  SecurityGrade,
  { bg: string; text: string; ring: string }
> = {
  A: {
    bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  B: {
    bg: "bg-blue-500/15 dark:bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/30",
  },
  C: {
    bg: "bg-amber-500/15 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
  },
  D: {
    bg: "bg-orange-500/15 dark:bg-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/30",
  },
  F: {
    bg: "bg-red-500/15 dark:bg-red-500/20",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/30",
  },
};
