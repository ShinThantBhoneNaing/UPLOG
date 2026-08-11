import { cn } from "@/lib/utils";
import type { ProjectStats } from "@/types/database";

export function ProjectProgress({
  stats,
  className,
  showNumbers = true,
}: {
  stats: ProjectStats;
  className?: string;
  showNumbers?: boolean;
}) {
  const pct =
    stats.total_tasks > 0
      ? Math.round((stats.done_tasks / stats.total_tasks) * 100)
      : 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of tasks completed`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-500",
            pct === 100 && "bg-success"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showNumbers && (
        <p className="mt-2 text-xs text-muted-foreground">
          {stats.total_tasks} tasks · {stats.done_tasks} done ·{" "}
          {stats.in_progress_tasks} in progress
          {stats.overdue_tasks > 0 && (
            <span className="font-medium text-destructive">
              {" "}
              · {stats.overdue_tasks} overdue
            </span>
          )}
        </p>
      )}
    </div>
  );
}
