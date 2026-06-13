import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      {/* Date range filter */}
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>

      {/* Session rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
