"use client";

interface SuccessAnimationProps {
  /** Controls visibility — render animation only when true (e.g., proxy === "connected") */
  show: boolean;
}

/**
 * A checkmark-draw success animation that completes one full cycle within 2 seconds of mount.
 * Renders only when `show` is true.
 */
export function SuccessAnimation({ show }: SuccessAnimationProps) {
  if (!show) return null;

  return (
    <div className="flex items-center justify-center animate-[scale-in_0.3s_ease-out]">
      <div className="relative flex size-20 items-center justify-center">
        {/* Outer ring pulse */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: "var(--secure)",
            opacity: 0.15,
            animation: "success-ring 1.8s ease-out forwards",
          }}
        />
        {/* Inner circle */}
        <div
          className="absolute flex size-16 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--secure)",
            opacity: 0,
            animation: "success-circle 0.4s ease-out 0.2s forwards",
          }}
        >
          {/* SVG checkmark draw */}
          <svg
            className="size-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline
              points="4 12 10 18 20 6"
              style={{
                strokeDasharray: 30,
                strokeDashoffset: 30,
                animation: "success-checkmark 0.5s ease-out 0.6s forwards",
              }}
            />
          </svg>
        </div>
        {/* Particle burst */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <span
            key={deg}
            className="absolute size-1.5 rounded-full"
            style={{
              backgroundColor: "var(--secure)",
              opacity: 0,
              transform: `rotate(${deg}deg) translateY(-8px)`,
              animation: `success-particle 0.8s ease-out 0.5s forwards`,
              animationFillMode: "forwards",
              // Use custom property for unique particle travel distance
              ["--particle-deg" as string]: `${deg}deg`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
