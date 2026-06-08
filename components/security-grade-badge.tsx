import { cn } from "@/lib/utils";
import { gradeColors, type SecurityGrade } from "@/lib/security-grade";

interface SecurityGradeBadgeProps {
  grade: SecurityGrade;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: "size-12 text-xl",
  md: "size-16 text-2xl",
  lg: "size-20 text-3xl",
};

export const SecurityGradeBadge = ({
  grade,
  size = "md",
  label,
  className,
}: SecurityGradeBadgeProps) => {
  const colors = gradeColors[grade];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-bold ring-2",
          sizeClasses[size],
          colors.bg,
          colors.text,
          colors.ring,
        )}
        aria-label={`Security grade ${grade}`}
      >
        {grade}
      </div>
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
};
