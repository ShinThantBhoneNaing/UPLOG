"use client";

import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import {
  DueBadge,
  LabelChip,
  PriorityBadge,
  StatusBadge,
} from "@/features/tasks/components/badges";
import type { TaskWithRelations } from "@/types/database";

/**
 * Quick task preview for the Standard Meeting board — everything the
 * meeting needs at a glance without leaving the wall. Closes on Escape,
 * outside click or ✕; "Open full task" is there when you do want the page.
 */
export function TaskPreviewDialog({
  task,
  onClose,
}: {
  task: TaskWithRelations | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {task && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 leading-snug">{task.title}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.labels.map((l) => (
                <LabelChip key={l.id} label={l} />
              ))}
            </div>

            <dl className="space-y-2.5 text-sm">
              {task.assignee && (
                <div className="flex items-center gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">Assignee</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    <UserAvatar
                      name={task.assignee.full_name}
                      avatarUrl={task.assignee.avatar_url}
                      className="size-6"
                    />
                    {task.assignee.full_name}
                  </dd>
                </div>
              )}
              {task.project && (
                <div className="flex items-center gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">Project</dt>
                  <dd className="font-medium">{task.project.name}</dd>
                </div>
              )}
              {task.due_date && (
                <div className="flex items-center gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">Due</dt>
                  <dd>
                    <DueBadge dueDate={task.due_date} done={task.status === "done"} />
                  </dd>
                </div>
              )}
              {task.time_taken_hours != null && (
                <div className="flex items-center gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">Time taken</dt>
                  <dd className="flex items-center gap-1.5 font-semibold tabular-nums">
                    <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                    {task.time_taken_hours}h
                  </dd>
                </div>
              )}
            </dl>

            {task.description && (
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm leading-relaxed scrollbar-thin">
                {task.description}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/tasks/${task.id}`} />}
              >
                Open full task <ArrowUpRight aria-hidden />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
