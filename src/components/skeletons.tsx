import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-72 w-full rounded-xl" />
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading tasks">
      <Skeleton className="h-7 w-40" />
      <div className="mt-6 flex gap-3 lg:grid lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-72 space-y-2 rounded-xl bg-muted/50 p-2 lg:w-auto">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
