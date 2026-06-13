import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = ["Create Org", "Scan Server", "Connect Proxy", "Done"];

export function OnboardingSteps({ currentStep }: { currentStep: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        const isPending = i > currentStep;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-300 border-2",
                  isComplete &&
                    "border-transparent text-white",
                  isCurrent &&
                    "border-transparent text-white",
                  isPending &&
                    "bg-transparent text-white/30",
                )}
                style={
                  isComplete
                    ? { backgroundColor: "var(--secure)", borderColor: "var(--secure)" }
                    : isCurrent
                      ? { backgroundColor: "var(--secure)", borderColor: "var(--secure)" }
                      : { borderColor: "var(--monitor)" }
                }
              >
                {isComplete ? (
                  <Check className="size-3.5" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] whitespace-nowrap",
                  isCurrent && "text-white",
                  isComplete && "text-white/60",
                  isPending && "text-white/25",
                )}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="mx-1.5 h-px w-12 sm:w-16 mb-5 transition-all duration-500"
                style={{
                  backgroundColor: i < currentStep ? "var(--secure)" : "var(--monitor)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
