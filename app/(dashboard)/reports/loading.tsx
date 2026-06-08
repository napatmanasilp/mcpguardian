import { Skeleton } from "@/components/ui/skeleton";

const ReportsLoading = () => {
  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
      </div>

      <Skeleton className="h-[400px] w-full rounded-md" />

      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
};

export default ReportsLoading;