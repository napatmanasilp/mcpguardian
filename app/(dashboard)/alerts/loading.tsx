import { Skeleton } from "@/components/ui/skeleton";

const AlertsLoading = () => {
  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
        <Skeleton className="h-4 w-12 ml-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-md" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 rounded-xl border p-4">
            <Skeleton className="size-3 shrink-0 rounded-full mt-1" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-2 shrink-0 rounded-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsLoading;
