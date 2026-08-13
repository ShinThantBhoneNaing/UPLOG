"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { cn, formatHours } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

type Column = "todo" | "inProgress" | "done";

/**
 * Digital sticky note: solid paper tint per status, folded bottom-right
 * corner, slight tilt that straightens on hover. Calm, not childish.
 */
const PAPER: Record<Column, { bg: string; fold: string }> = {
  todo: {
    bg: "bg-warning/15 hover:bg-warning/20 dark:bg-warning/12 dark:hover:bg-warning/18",
    fold: "bg-warning/40",
  },
  inProgress: {
    bg: "bg-primary/12 hover:bg-primary/18 dark:bg-primary/14 dark:hover:bg-primary/20",
    fold: "bg-primary/40",
  },
  done: {
    bg: "bg-success/12 hover:bg-success/18 dark:bg-success/12 dark:hover:bg-success/18",
    fold: "bg-success/40",
  },
};

/** Tiny deterministic tilt per card — straightens on hover. */
function tilt(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const classes = ["-rotate-1", "rotate-[0.75deg]", "-rotate-[0.5deg]", "rotate-1", "rotate-0"];
  return classes[n % classes.length];
}

export function StickyCard({
  task,
  column,
  large = false,
  onOpen,
}: {
  task: TaskWithRelations;
  column: Column;
  /** Meeting-mode: bigger type for across-the-room readability. */
  large?: boolean;
  /** When set, clicking opens this handler (popup) instead of navigating. */
  onOpen?: (task: TaskWithRelations) => void;
}) {
  const urgent = task.priority === "urgent" || task.priority === "high";
  const paper = PAPER[column];

  const className = cn(
    "relative block w-full rounded-md p-3 text-left shadow-sm transition-all duration-150",
    "hover:rotate-0 hover:shadow-md hover:-translate-y-0.5",
    "[clip-path:polygon(0_0,100%_0,100%_calc(100%-11px),calc(100%-11px)_100%,0_100%)]",
    paper.bg,
    tilt(task.id),
    column === "done" && "opacity-85"
  );

  const content = (
    <>
      {/* folded corner */}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-0 right-0 size-[11px] [clip-path:polygon(0_0,100%_0,0_100%)]",
          paper.fold
        )}
      />

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
          "mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5",
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
        {task.time_taken_hours != null && (
          <span className="tabular-nums font-semibold text-foreground/70">
            {formatHours(task.time_taken_hours)}
          </span>
        )}
        {task.project && (
          <span className="truncate text-muted-foreground">
            {task.project.name}
          </span>
        )}
        {task.labels[0] && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: task.labels[0].color }}
              aria-hidden
            />
            {task.labels[0].name}
          </span>
        )}
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(task)} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link href={`/tasks/${task.id}`} draggable={false} className={className}>
      {content}
    </Link>
  );
}
