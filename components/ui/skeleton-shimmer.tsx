import { cn } from "@/lib/utils";

export function ServerCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-white/10 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="size-2 rounded-full shimmer" />
        <div className="h-4 w-48 rounded shimmer" />
        <div className="h-5 w-12 rounded-full shimmer ml-auto" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 rounded shimmer" />
        ))}
      </div>
      <div className="h-1 w-full rounded shimmer" />
    </div>
  );
}

export function ThreatRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border-l-2 border-white/10">
      <div className="h-4 w-4 rounded shimmer" />
      <div className="h-4 w-24 rounded shimmer" />
      <div className="h-4 w-48 rounded shimmer" />
      <div className="h-4 w-16 rounded shimmer ml-auto" />
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="p-5 rounded-xl border border-white/10 space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-md shimmer" />
        <div className="h-3 w-32 rounded shimmer" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="text-center space-y-1">
            <div className="h-8 w-12 rounded shimmer mx-auto" />
            <div className="h-3 w-16 rounded shimmer mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-9 rounded shimmer" />
      ))}
    </div>
  );
}
