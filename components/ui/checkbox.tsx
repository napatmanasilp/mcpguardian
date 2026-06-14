"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        ref={ref}
        className={cn(
          "peer size-4 shrink-0 rounded border border-white/30 ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors",
          checked && "bg-blue-600 border-blue-600 text-white",
          className,
        )}
        onClick={() => onCheckedChange?.(!checked)}
        {...props}
      >
        {checked && <Check className="size-3 mx-auto" />}
      </button>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
