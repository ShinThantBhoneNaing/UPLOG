"use client";

import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";
import { DueBadge, LabelChip, PriorityBadge } from "./badges";

/**
 * Board card. The whole card is a link to the task; drag is handled by
 * the wrapper in board.tsx.
 */
export function TaskCard({
  task,
  className,
}: {
  task: TaskWithRelations;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm",
        className
      )}
    >
      <Link
        href={`/tasks/${task.id}`}
        className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
        draggable={false}
      >
        {task.title}
      </Link>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {task.due_date && (
            <DueBadge dueDate={task.due_date} done={task.status === "done"} />
          )}
        </div>
        {task.assignee && (
          <UserAvatar
            name={task.assignee.full_name}
            avatarUrl={task.assignee.avatar_url}
            className="size-6"
          />
        )}
      </div>

      {task.project && (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {task.project.name}
        </p>
      )}
    </div>
  );
}
