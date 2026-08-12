"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

type Column = "todo" | "inProgress" | "done";

/** Subtle status tints on the UPLOG palette — sticky note, not spreadsheet. */
const TINTS: Record<Column, string> = {
  todo: "bg-warning/8 border-warning/30 hover:border-warning/50",
  inProgress: "bg-primary/8 border-primary/30 hover:border-primary/50",
  done: "bg-success/8 border-success/30 hover:border-success/50",
};

/** Tiny deterministic tilt per card — straightens on hover. */
function tilt(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const classes = ["-rotate-1", "rotate-0", "rotate-1", "-rotate-[0.5deg]", "rotate-[0.7deg]"];
  return classes[n % classes.length];
}

export function StickyCard({
  task,
  column,
  large = false,
}: {
  task: TaskWithRelations;
  column: Column;
  /** Meeting-mode: bigger type for across-the-room readability. */
  large?: boolean;
}) {
  const urgent = task.priority === "urgent" || task.priority === "high";

  return (
    <Link
      href={`/tasks/${task.id}`}
      draggable={false}
      className={cn(
        "block rounded-lg border p-2.5 shadow-xs transition-all hover:rotate-0 hover:shadow-md",
        TINTS[column],
        tilt(task.id),
        column === "done" && "opacity-85"
      )}
    >
      <p
        className={cn(
          "font-medium leading-snug",
          large ? "line-clamp-3 text-sm" : "line-clamp-2 text-xs",
          column === "done" && "text-muted-foreground"
        )}
      >
        {task.title}
      </p>

      <div
        className={cn(
          "mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5",
          large ? "text-xs" : "text-[10px]"
        )}
      >
        {urgent && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              task.priority === "urgent" ? "text-destructive" : "text-primary"
            )}
          >
            <Flag className={large ? "size-3" : "size-2.5"} aria-hidden />
            {task.priority === "urgent" ? "Urgent" : "High"}
          </span>
        )}
        {task.estimate_hours != null && (
          <span className="tabular-nums font-medium text-foreground/70">
            {task.estimate_hours}h
          </span>
        )}
        {task.project && (
          <span className="truncate text-muted-foreground">
            {task.project.name}
          </span>
        )}
        {task.labels[0] && (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: task.labels[0].color }}
              aria-hidden
            />
            {task.labels[0].name}
          </span>
        )}
      </div>
    </Link>
  );
}
