import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  cn,
  dueLabel,
  PRIORITY_META,
  STATUS_META,
} from "@/lib/utils";
import type { Label as LabelRow, TaskPriority, TaskStatus } from "@/types/database";

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1.5 font-medium", meta.badge, className)}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge variant="outline" className={cn("gap-1", meta.badge, className)}>
      <Flag className="size-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}

export function LabelChip({ label }: { label: LabelRow }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground"
      style={{ borderColor: `${label.color}66` }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: label.color }}
        aria-hidden
      />
      {label.name}
    </span>
  );
}

export function DueBadge({
  dueDate,
  done,
  className,
}: {
  dueDate: string;
  done?: boolean;
  className?: string;
}) {
  const { label, overdue } = dueLabel(dueDate);
  return (
    <span
      className={cn(
        "text-xs",
        overdue && !done
          ? "font-medium text-destructive"
          : "text-muted-foreground",
        className
      )}
    >
      {overdue && !done ? `Overdue · ${label}` : label}
    </span>
  );
}
