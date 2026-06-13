"use client";

interface Props {
  password: string;
}

export type StrengthLevel = "weak" | "fair" | "strong";

export function computeStrength(password: string): StrengthLevel {
  if (password.length < 8) return "weak";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigitOrSpecial = /[0-9!-/:-@[-`{-~]/.test(password);
  if (hasUpper && hasLower && hasDigitOrSpecial) return "strong";
  return "fair";
}

export function PasswordStrengthMeter({ password }: Props) {
  const strength = computeStrength(password);

  const segmentColors = {
    weak: "bg-threat",
    fair: "bg-amber-500",
    strong: "bg-secure",
  };

  const activeSegments = strength === "weak" ? 1 : strength === "fair" ? 2 : 3;

  const label = strength === "weak" ? "Weak" : strength === "fair" ? "Fair" : "Strong";

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map((segment) => (
          <div
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors ${
              segment <= activeSegments
                ? segmentColors[strength]
                : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p
        className={`text-xs ${
          strength === "weak"
            ? "text-threat"
            : strength === "fair"
              ? "text-amber-500"
              : "text-secure"
        }`}
      >
        {label}
      </p>
    </div>
  );
}
