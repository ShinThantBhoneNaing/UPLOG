import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading Standard Meeting board">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="mt-4 h-11 w-full rounded-xl" />
      <div className="mt-4 space-y-px overflow-hidden rounded-xl border">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
